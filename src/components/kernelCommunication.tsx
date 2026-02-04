// Based on https://github.com/jupyterlab/extension-examples/blob/main/kernel-messaging

import { JupyterFrontEnd } from '@jupyterlab/application';
import {
  SessionContext
  // SessionContextDialogs
} from '@jupyterlab/apputils';
import { useEffect, useState } from 'react';
import { Kernel, KernelMessage } from '@jupyterlab/services';
import { IOutput } from '@jupyterlab/nbformat';

const SESSION_NAME = 'tenant-data-browser';

export type KernelErrorType =
  | 'not_available'
  | 'not_ready'
  | 'execution_error'
  | 'timeout'
  | 'dead';

const ERROR_MESSAGES: Record<KernelErrorType, string> = {
  not_available: 'Kernel is not available',
  not_ready: 'Kernel is not ready',
  timeout: 'Request timed out',
  dead: 'Kernel has stopped',
  execution_error: 'Execution error'
};

export class KernelError extends Error {
  public readonly type: KernelErrorType;
  public readonly traceback?: string[];
  public readonly ename?: string;
  public readonly evalue?: string;

  constructor(
    type: KernelErrorType,
    details?: { ename?: string; evalue?: string; traceback?: string[] }
  ) {
    const baseMessage = ERROR_MESSAGES[type];
    const detailMessage = details?.evalue
      ? `${details.ename || 'Error'}: ${details.evalue}`
      : '';
    super(detailMessage || baseMessage);

    this.name = 'KernelError';
    this.type = type;
    this.ename = details?.ename;
    this.evalue = details?.evalue;
    this.traceback = details?.traceback;
  }
}

const KERNEL_NAME = 'python3';
const KERNEL_START_TIMEOUT_MS = 60000;
const KERNEL_EXEC_TIMEOUT_MS = 30000;

/** Creates and initializes a sessionContext for use with a kernel */
export const useSessionContext = (app: JupyterFrontEnd) => {
  const [sc, setSc] = useState<SessionContext | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    const manager = app.serviceManager;
    let sessionContext: SessionContext | undefined;
    let disposed = false;

    const initSession = async () => {
      try {
        // Wait for kernelspecs to be ready
        await manager.kernelspecs.ready;

        // Check if python3 kernelspec exists
        const specs = manager.kernelspecs.specs;
        if (!specs || !specs.kernelspecs[KERNEL_NAME]) {
          const available = specs
            ? Object.keys(specs.kernelspecs).join(', ')
            : 'none';
          throw new Error(
            `Kernel '${KERNEL_NAME}' not found. ` + `Available: ${available}`
          );
        }

        sessionContext = new SessionContext({
          sessionManager: manager.sessions,
          specsManager: manager.kernelspecs,
          name: SESSION_NAME
        });

        const needsKernel = await sessionContext.initialize();

        if (disposed) {
          return;
        }

        if (needsKernel) {
          // Start kernel with timeout
          const kernelPromise = sessionContext.changeKernel({
            name: KERNEL_NAME
          });

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  'Timeout starting kernel after ' +
                    `${KERNEL_START_TIMEOUT_MS / 1000}s`
                )
              );
            }, KERNEL_START_TIMEOUT_MS);
          });

          await Promise.race([kernelPromise, timeoutPromise]);
        }

        if (disposed) {
          return;
        }

        // Monitor for kernel death and auto-reconnect
        // Use sessionContext.statusChanged (not kernel.statusChanged) so
        // listener survives kernel restarts
        const onStatusChange = async () => {
          if (disposed || !sessionContext) {
            return;
          }
          const status = sessionContext.session?.kernel?.status;
          if (status === 'dead') {
            console.warn('Kernel died, attempting to reconnect...');
            setIsConnecting(true);
            try {
              await sessionContext.changeKernel({ name: KERNEL_NAME });
              if (!disposed) {
                setError(undefined);
                console.log('Kernel reconnected successfully');
              }
            } catch (reconnectError) {
              if (!disposed) {
                setError(new Error('Kernel died and reconnection failed'));
                console.error('Failed to reconnect kernel:', reconnectError);
              }
            } finally {
              if (!disposed) {
                setIsConnecting(false);
              }
            }
          }
        };
        sessionContext.statusChanged.connect(onStatusChange);

        setSc(sessionContext);
      } catch (reason) {
        if (disposed) {
          return;
        }
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError(new Error(message));
        console.error('Failed to initialize kernel session:', reason);
      } finally {
        if (!disposed) {
          setIsConnecting(false);
        }
      }
    };

    initSession();

    return () => {
      disposed = true;
      sessionContext?.dispose();
      setSc(undefined);
      setError(undefined);
      setIsConnecting(true);
    };
  }, [app.serviceManager]);

  return { sessionContext: sc, error, isConnecting };
};

/** Wait for kernel to be ready (idle status) */
const waitForKernelReady = async (
  kernel: Kernel.IKernelConnection,
  timeoutMs: number = 30000
): Promise<void> => {
  const readyStatuses = ['idle'];
  const badStatuses = ['dead', 'unknown'];

  if (readyStatuses.includes(kernel.status)) {
    return;
  }

  if (badStatuses.includes(kernel.status)) {
    throw new KernelError(kernel.status === 'dead' ? 'dead' : 'not_ready');
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new KernelError('timeout'));
    }, timeoutMs);

    const onStatusChanged = () => {
      if (readyStatuses.includes(kernel.status)) {
        clearTimeout(timeoutId);
        kernel.statusChanged.disconnect(onStatusChanged);
        resolve();
      } else if (badStatuses.includes(kernel.status)) {
        clearTimeout(timeoutId);
        kernel.statusChanged.disconnect(onStatusChanged);
        reject(
          new KernelError(kernel.status === 'dead' ? 'dead' : 'not_ready')
        );
      }
    };

    kernel.statusChanged.connect(onStatusChanged);
  });
};

/** Executes a kernel query in a given sessionContext */
export const queryKernel = async (
  code: string,
  sessionContext: SessionContext
): Promise<{ data?: IOutput; error?: KernelError }> => {
  const kernel = sessionContext?.session?.kernel;
  if (!kernel) {
    return { error: new KernelError('not_available') };
  }

  // Wait for kernel to be ready before executing
  try {
    await waitForKernelReady(kernel);
  } catch (error) {
    if (error instanceof KernelError) {
      return { error };
    }
    return { error: new KernelError('not_ready') };
  }

  const future: Kernel.IFuture<
    KernelMessage.IExecuteRequestMsg,
    KernelMessage.IExecuteReplyMsg
  > = kernel.requestExecute({ code });

  const result = await new Promise<{ data?: IOutput; error?: KernelError }>(
    resolve => {
      let hasResolved = false;

      future.onIOPub = (msg: KernelMessage.IIOPubMessage): void => {
        const msgType = msg.header.msg_type;
        switch (msgType) {
          case 'execute_result':
          case 'display_data':
          case 'update_display_data':
            if (!hasResolved) {
              hasResolved = true;
              resolve({ data: msg.content as IOutput });
            }
            break;
          case 'stream': {
            // Log print() output for debugging
            const streamContent = msg.content as {
              name: 'stdout' | 'stderr';
              text: string;
            };
            if (streamContent.name === 'stderr') {
              console.warn('Kernel stderr:', streamContent.text);
            } else {
              console.debug('Kernel stdout:', streamContent.text);
            }
            break;
          }
          case 'error':
            if (!hasResolved) {
              hasResolved = true;
              const errorContent = msg.content as {
                ename: string;
                evalue: string;
                traceback?: string[];
              };
              const error = new KernelError('execution_error', errorContent);
              resolve({ error });
            }
            break;
          default:
            break;
        }
      };

      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve({ error: new KernelError('timeout') });
        }
      }, KERNEL_EXEC_TIMEOUT_MS);
    }
  );

  future.dispose();
  return result;
};

export const parseKernelOutputJSON = <ExpectedType,>(
  output?: IOutput
): ExpectedType | undefined => {
  if (
    output?.data &&
    typeof output.data === 'object' &&
    'text/plain' in output.data
  ) {
    try {
      const rawText = output.data['text/plain'] as string;
      const cleanedText = rawText.replace(/^'|'$/g, '');
      return JSON.parse(cleanedText) as ExpectedType;
    } catch (error) {
      console.error('Failed to parse kernel output as JSON:', {
        output,
        error: error instanceof Error ? error.message : error
      });
      return undefined;
    }
  }
  console.warn(
    'Invalid kernel output format - missing text/plain data:',
    output
  );
  return undefined;
};
