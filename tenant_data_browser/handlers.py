"""
HTTP handlers for the Tenant Data Browser server extension.

Provides REST API endpoints that proxy calls to the CDM data access methods,
with automatic fallback to mock data when berdl_notebook_utils is not installed.
"""

import json
import logging
from typing import Any

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado.web

from .cdm_methods import get_cdm_methods

logger = logging.getLogger(__name__)

# Initialize CDM methods at module level (preserves mock fallback behavior)
(
    get_table_schema,
    get_databases,
    get_tables,
    get_my_groups,
    get_namespace_prefix,
    using_mocks,
) = get_cdm_methods()


class BaseHandler(APIHandler):
    """Base handler with common utilities."""

    def write_json(self, data: dict[str, Any] | list, status: int = 200) -> None:
        """Write JSON response."""
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps(data))

    def write_error_json(self, message: str, status: int = 500) -> None:
        """Write JSON error response."""
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        self.finish(json.dumps({"error": message}))


class GroupsHandler(BaseHandler):
    """Handler for fetching user's group memberships."""

    @tornado.web.authenticated
    def get(self) -> None:
        """
        GET /api/tenant-data-browser/groups

        Returns user's groups.
        """
        try:
            result = get_my_groups(return_json=False)
            self.write_json(result)
        except Exception as e:
            logger.exception("Error fetching groups")
            self.write_error_json(str(e), status=500)


class DatabasesHandler(BaseHandler):
    """Handler for fetching databases with namespace prefix."""

    @tornado.web.authenticated
    def get(self) -> None:
        """
        GET /api/tenant-data-browser/databases?tenant=<name>

        Returns databases and namespace prefix info.
        Optional tenant query parameter filters by tenant namespace.
        """
        try:
            tenant = self.get_argument("tenant", default=None)

            databases = get_databases(
                use_hms=True, return_json=False, filter_by_namespace=True
            )
            prefix = get_namespace_prefix(tenant=tenant, return_json=False)

            self.write_json({"databases": databases, "prefix": prefix})
        except Exception as e:
            logger.exception("Error fetching databases")
            self.write_error_json(str(e), status=500)


class TablesHandler(BaseHandler):
    """Handler for fetching tables in a database."""

    @tornado.web.authenticated
    def get(self) -> None:
        """
        GET /api/tenant-data-browser/tables?database=<name>

        Returns list of table names for the specified database.
        """
        try:
            database = self.get_argument("database")
        except tornado.web.MissingArgumentError:
            self.write_error_json("database query parameter is required", status=400)
            return

        try:
            tables = get_tables(database, use_hms=True, return_json=False)
            self.write_json(tables)
        except Exception as e:
            logger.exception(f"Error fetching tables for database {database}")
            self.write_error_json(str(e), status=500)


class SchemaHandler(BaseHandler):
    """Handler for fetching table schema."""

    @tornado.web.authenticated
    def get(self) -> None:
        """
        GET /api/tenant-data-browser/schema?database=<name>&table=<name>

        Returns list of column names for the specified table.
        """
        try:
            database = self.get_argument("database")
            table = self.get_argument("table")
        except tornado.web.MissingArgumentError as e:
            self.write_error_json(
                f"{e.arg_name} query parameter is required", status=400
            )
            return

        try:
            schema = get_table_schema(database, table, return_json=False)
            self.write_json(schema)
        except Exception as e:
            logger.exception(
                f"Error fetching schema for {database}.{table}"
            )
            self.write_error_json(str(e), status=500)


class NamespacePrefixHandler(BaseHandler):
    """Handler for fetching namespace prefix."""

    @tornado.web.authenticated
    def get(self) -> None:
        """
        GET /api/tenant-data-browser/namespace-prefix?tenant=<name>

        Returns namespace prefix info. Optional tenant query parameter.
        """
        try:
            tenant = self.get_argument("tenant", default=None)
            result = get_namespace_prefix(tenant=tenant, return_json=False)
            self.write_json(result)
        except Exception as e:
            logger.exception("Error fetching namespace prefix")
            self.write_error_json(str(e), status=500)


def setup_handlers(web_app: Any) -> None:
    """Register handlers with the Jupyter server."""
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]
    base_path = url_path_join(base_url, "api", "tenant-data-browser")

    handlers = [
        (url_path_join(base_path, "groups"), GroupsHandler),
        (url_path_join(base_path, "databases"), DatabasesHandler),
        (url_path_join(base_path, "tables"), TablesHandler),
        (url_path_join(base_path, "schema"), SchemaHandler),
        (url_path_join(base_path, "namespace-prefix"), NamespacePrefixHandler),
    ]

    web_app.add_handlers(host_pattern, handlers)
    logger.info("Tenant Data Browser handlers registered")
