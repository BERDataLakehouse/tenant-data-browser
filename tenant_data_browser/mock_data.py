"""
Mock data for CDM tree browser development and testing.

This module contains sample database structures and tenant configurations
used when real BERDL or CDM environments are not available.
"""

# Mock username for consistent prefixing
MOCK_USERNAME = "mock_user"

# Mock tenant/group configuration
# Includes 'ro' (read-only) variants to test deduplication logic
MOCK_GROUPS = {
    "username": MOCK_USERNAME,
    "groups": [
        "kbase",
        "kbasero",      # read-only copy - should dedupe to 'kbase'
        "globalusers",
        "globalusersro", # read-only copy - should dedupe to 'globalusers'
        "demo",
    ],
    "group_count": 5
}

# Namespace prefix configuration
MOCK_NAMESPACE_PREFIXES = {
    "user": f"u_{MOCK_USERNAME}__",
    "kbase": "kbase_",
    "globalusers": "globalusers_",
    "demo": "demo_",
}

# Mock database structure with tables
# Database names follow patterns:
#   - User databases: u_{username}__{database_name}
#   - Tenant databases: {tenant}_{database_name}
MOCK_DATABASE_STRUCTURE = {
    # === USER DATABASES (My Data) ===
    f"u_{MOCK_USERNAME}__scratch": [
        "experiment_results",
        "temp_analysis",
        "notes",
    ],
    f"u_{MOCK_USERNAME}__my_project": [
        "samples",
        "measurements",
        "analysis_runs",
        "plots",
    ],

    # === KBASE TENANT DATABASES ===
    "kbase_cdm": [
        "person",
        "visit_occurrence",
        "visit_detail",
        "condition_occurrence",
        "drug_exposure",
        "procedure_occurrence",
        "device_exposure",
        "measurement",
        "observation",
        "death",
        "note",
        "specimen",
    ],
    "kbase_vocabulary": [
        "concept",
        "concept_ancestor",
        "concept_relationship",
        "concept_synonym",
        "vocabulary",
        "domain",
        "concept_class",
        "relationship",
    ],
    "kbase_genomics": [
        "genomic_info",
        "variant_occurrence",
        "variant_annotation",
        "gene_expression",
        "mutation",
    ],

    # === GLOBALUSERS TENANT DATABASES ===
    "globalusers_shared_data": [
        "public_datasets",
        "reference_genomes",
        "annotation_tracks",
    ],
    "globalusers_demo_shared": [
        "tenant_test_table",
        "sample_data",
    ],

    # === DEMO TENANT DATABASES ===
    "demo_clinical_trials": [
        "trial",
        "trial_arm",
        "trial_participant",
        "trial_outcome",
        "adverse_event",
    ],
    "demo_imaging": [
        "imaging_study",
        "imaging_series",
        "dicom_metadata",
        "radiology_report",
    ],
    "demo_laboratory": [
        "lab_test_catalog",
        "lab_result",
        "lab_panel",
        "reference_range",
    ],
}

# Mock table schemas - maps table names to column lists
# Falls back to generic columns if table not found
MOCK_TABLE_SCHEMAS = {
    # Simple tables
    "tenant_test_table": ["id", "name", "age"],
    "sample_data": ["id", "value", "timestamp"],
    "notes": ["id", "title", "content", "created_at"],

    # User project tables
    "samples": ["sample_id", "name", "source", "collection_date", "status"],
    "measurements": ["measurement_id", "sample_id", "metric", "value", "unit", "recorded_at"],
    "analysis_runs": ["run_id", "name", "parameters", "status", "started_at", "completed_at"],
    "experiment_results": ["result_id", "experiment_name", "outcome", "notes", "created_at"],

    # CDM tables
    "person": ["person_id", "gender_concept_id", "year_of_birth", "race_concept_id", "ethnicity_concept_id"],
    "visit_occurrence": ["visit_occurrence_id", "person_id", "visit_concept_id", "visit_start_date", "visit_end_date", "visit_type_concept_id"],
    "condition_occurrence": ["condition_occurrence_id", "person_id", "condition_concept_id", "condition_start_date", "condition_end_date"],
    "drug_exposure": ["drug_exposure_id", "person_id", "drug_concept_id", "drug_exposure_start_date", "drug_exposure_end_date", "quantity"],
    "measurement": ["measurement_id", "person_id", "measurement_concept_id", "measurement_date", "value_as_number", "unit_concept_id"],

    # Vocabulary tables
    "concept": ["concept_id", "concept_name", "domain_id", "vocabulary_id", "concept_class_id", "concept_code"],
    "concept_ancestor": ["ancestor_concept_id", "descendant_concept_id", "min_levels_of_separation", "max_levels_of_separation"],
    "vocabulary": ["vocabulary_id", "vocabulary_name", "vocabulary_reference", "vocabulary_version"],

    # Genomics tables
    "variant_occurrence": ["variant_id", "person_id", "chromosome", "position", "reference", "alternate", "quality"],
    "gene_expression": ["expression_id", "person_id", "gene_symbol", "expression_value", "sample_type"],
}

# Default columns for tables not in MOCK_TABLE_SCHEMAS
MOCK_DEFAULT_COLUMNS = [
    "id",
    "name",
    "description",
    "created_at",
    "updated_at",
]
