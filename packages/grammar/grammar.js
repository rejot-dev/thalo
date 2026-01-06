export default grammar({
  name: "ptall",

  extras: (_) => [" "],

  conflicts: ($) => [[$.instance_entry], [$.content]],

  rules: {
    source_file: ($) => repeat(choice($.entry, $._nl)),

    // Entry can be either an instance (create/update) or schema (define-entity/alter-entity)
    entry: ($) => choice($.instance_entry, $.schema_entry),

    // ===================
    // Instance entries (create/update lore, opinion, etc.)
    // ===================

    instance_entry: ($) => seq($.instance_header, $._eol, repeat($.metadata), optional($.content)),

    instance_header: ($) =>
      seq(
        field("timestamp", $.timestamp),
        field("directive", $.instance_directive),
        field("entity", $.entity),
        field("title", $.title),
        repeat(choice($.link, $.tag)),
      ),

    instance_directive: (_) => choice("create", "update"),

    entity: (_) => choice("lore", "opinion", "reference", "journal"),

    metadata: ($) => seq($._indent, field("key", $.key), ":", field("value", $.value), $._eol),

    // ===================
    // Schema entries (define-entity/alter-entity)
    // ===================

    schema_entry: ($) => seq($.schema_header, repeat($._schema_block)),

    schema_header: ($) =>
      seq(
        field("timestamp", $.timestamp),
        field("directive", $.schema_directive),
        field("entity_name", $.identifier),
        field("title", $.title),
        repeat(choice($.link, $.tag)),
      ),

    schema_directive: (_) => choice("define-entity", "alter-entity"),

    identifier: (_) => token(/[a-z][a-zA-Z0-9\-_]*/),

    // ===================
    // Schema blocks
    // ===================

    _schema_block: ($) =>
      choice($.metadata_block, $.sections_block, $.remove_metadata_block, $.remove_sections_block),

    metadata_block: ($) => prec(2, seq($._metadata_header, repeat1($.field_definition))),

    sections_block: ($) => prec(2, seq($._sections_header, $._section_lines)),

    _section_lines: ($) => prec.right(repeat1($.section_definition)),

    remove_metadata_block: ($) => prec(2, seq($._remove_metadata_header, repeat1($.field_removal))),

    remove_sections_block: ($) =>
      prec(2, seq($._remove_sections_header, repeat1($.section_removal))),

    // Block headers include newline+indent to avoid extras interference
    _metadata_header: (_) => token(/\r?\n {2}# Metadata */),
    _sections_header: (_) => token(/\r?\n {2}# Sections */),
    _remove_metadata_header: (_) => token(/\r?\n {2}# Remove Metadata */),
    _remove_sections_header: (_) => token(/\r?\n {2}# Remove Sections */),

    // ===================
    // Field definitions
    // ===================

    field_definition: ($) =>
      seq(
        $._field_line_start,
        optional($.optional_marker),
        ":",
        field("type", $.type_expression),
        optional(seq("=", field("default", $.default_value))),
        optional(seq(";", field("description", $.description))),
      ),

    // Match field name with preceding newline and indent
    _field_line_start: ($) => alias($._field_name_token, $["field_name"]),
    _field_name_token: (_) => token(/\r?\n {2}[a-z][a-zA-Z0-9\-_]*/),

    optional_marker: (_) => "?",

    description: (_) => token(/"[^"]*"/),

    // ===================
    // Section definitions
    // ===================

    // Section line is a complete line including newline to prevent extras interference
    section_definition: ($) =>
      seq(
        $._section_line_start,
        optional($.optional_marker),
        optional(seq(";", field("description", $.description))),
      ),

    // Match section name with preceding newline and indent
    _section_line_start: ($) => alias($._section_name_token, $["section_name"]),
    _section_name_token: (_) => token(/\r?\n {2}[A-Z][a-zA-Z0-9]*/),

    // ===================
    // Removals (for alter-entity)
    // ===================

    field_removal: ($) =>
      seq($._field_line_start, optional(seq(";", field("reason", $.description)))),

    section_removal: ($) =>
      seq($._section_line_start, optional(seq(";", field("reason", $.description)))),

    // ===================
    // Type expressions
    // ===================

    type_expression: ($) => choice($.union_type, $._type_term),

    union_type: ($) => prec.left(1, seq($._type_term, repeat1(seq("|", $._type_term)))),

    _type_term: ($) => choice($.array_type, $.primitive_type, $.literal_type),

    array_type: ($) => seq(choice($.primitive_type, $.literal_type), token.immediate("[]")),

    primitive_type: (_) => choice("string", "date", "date-range", "link"),

    literal_type: (_) => token(/"[^"]*"/),

    default_value: ($) => choice($.literal_type, $._plain_default),

    _plain_default: (_) => token(/[^;\r\n]+/),

    // ===================
    // Content (for instance entries)
    // ===================

    content: ($) =>
      seq(
        $._nl,
        repeat($._content_blank),
        $._content_first,
        repeat(choice($.markdown_header, $.content_line, $._content_blank)),
      ),

    _content_first: ($) => choice($.markdown_header, $.content_line),

    _content_blank: ($) => $._nl,

    // Note: _eol is optional to handle content at EOF without trailing newline
    // prec.right ensures we consume the newline when present (prefer shift over reduce)
    markdown_header: ($) =>
      prec.right(2, seq($._indent, $._md_hashes, $._md_text, optional($._eol))),

    _md_hashes: (_) => token.immediate(/#+/),
    _md_text: (_) => token(/ [^\r\n]+/),

    // Note: _eol is optional to handle content at EOF without trailing newline
    // prec.right ensures we consume the newline when present (prefer shift over reduce)
    content_line: ($) => prec.right(1, seq($._indent, $._content_text, optional($._eol))),

    _content_text: (_) => token(/[^#\r\n][^\r\n]*/),

    // ===================
    // Common tokens
    // ===================

    _nl: (_) => /\r?\n/,

    _indent: (_) => token.immediate(/ {2}/),

    _eol: (_) => /\r?\n/,

    timestamp: (_) => token(/[12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d/),

    title: (_) => token(/"[^"]*"/),

    link: (_) => token(/\^[A-Za-z0-9\-_/.]+/),

    tag: (_) => token(/#[A-Za-z0-9\-_/.]+/),

    key: (_) => token(/[a-z][a-zA-Z0-9\-_]*/),

    value: ($) => choice(prec(1, $.link), $._quoted_string, $._plain_value),

    _quoted_string: (_) => token(/"[^"]*"/),

    _plain_value: (_) => token(/[^\r\n]+/),
  },
});
