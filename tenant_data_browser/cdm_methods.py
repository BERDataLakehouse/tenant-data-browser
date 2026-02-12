import logging

logger = logging.getLogger(__name__)


def get_cdm_methods():
    """
    Returns BERDL data access methods.
    Tries to import from BERDL (berdl_notebook_utils) first, falls back to mock functions.
    Returns (get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, using_mocks)
    """
    try:
        from berdl_notebook_utils.spark import (
            get_databases,
            get_tables,
            get_table_schema,
        )
        from berdl_notebook_utils.minio_governance.operations import (
            get_my_groups as _get_my_groups,
            get_namespace_prefix as _get_namespace_prefix,
        )
        logger.info("Using BERDL berdl_notebook_utils functions")

        def get_my_groups(return_json=False):
            import json
            result = _get_my_groups()
            result_dict = {
                'username': result.username,
                'groups': result.groups,
                'group_count': result.group_count,
            }
            if return_json:
                return json.dumps(result_dict)
            return result_dict

        def get_namespace_prefix(tenant=None, return_json=False):
            import json
            result = _get_namespace_prefix(tenant=tenant)
            result_dict = {
                'username': result.username,
                'user_namespace_prefix': result.user_namespace_prefix,
                # Use getattr because these fields may not exist on the
                # Pydantic model when tenant is None
                'tenant': getattr(result, 'tenant', None),
                'tenant_namespace_prefix': getattr(result, 'tenant_namespace_prefix', None),
            }
            if return_json:
                return json.dumps(result_dict)
            return result_dict

        return get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, False
    except Exception as e:
        logger.warning("BERDL import failed: %s", e)
        logger.info("Using mock functions")

    from .mock_definitions import get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix

    return get_table_schema, get_databases, get_tables, get_my_groups, get_namespace_prefix, True