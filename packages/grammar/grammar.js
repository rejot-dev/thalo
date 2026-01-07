export default grammar({
  name: "ptall",

  extras: ($) => [" ", $.comment],

  externals: ($) => [
    $["_indent"], // Newline followed by indentation (1+ spaces or tab)
    $["_content_blank"], // Blank line within content blocks
    $["error_sentinel"], // Detects error recovery mode
  ],

  rules: {
    source_file: ($) => repeat(choice($.entry, $._nl)),

    // Standalone comment lines inside entries are skipped by the scanner
    comment: (_) => token(seq("//", /[^\r\n]*/)),

    entry: ($) => choice($.instance_entry, $.schema_entry),

    // =========================================================================
    // Instance entries (create/update lore, opinion, etc.)
    // =========================================================================

    instance_entry: ($) => seq($.instance_header, repeat($.metadata), optional($.content)),

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

    // prec(2) to prefer metadata over content_line when we see key:value
    metadata: ($) => prec(2, seq($["_indent"], field("key", $.key), ":", field("value", $.value))),

    // =========================================================================
    // Schema entries (define-entity/alter-entity)
    // =========================================================================

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

    // =========================================================================
    // Schema blocks (# Metadata, # Sections, # Remove Metadata, # Remove Sections)
    // =========================================================================

    _schema_block: ($) =>
      choice($.metadata_block, $.sections_block, $.remove_metadata_block, $.remove_sections_block),

    metadata_block: ($) => prec(2, seq($._metadata_header, repeat1($.field_definition))),
    sections_block: ($) => prec(2, seq($._sections_header, $._section_lines)),
    remove_metadata_block: ($) => prec(2, seq($._remove_metadata_header, repeat1($.field_removal))),
    remove_sections_block: ($) =>
      prec(2, seq($._remove_sections_header, repeat1($.section_removal))),

    _section_lines: ($) => prec.right(repeat1($.section_definition)),

    // Block headers: newline + optional blank lines + indent + "# BlockName"
    _metadata_header: (_) => token(/\r?\n(?:[ \t]*\r?\n)*(?:\t|[ \t][ \t])+# Metadata */),
    _sections_header: (_) => token(/\r?\n(?:[ \t]*\r?\n)*(?:\t|[ \t][ \t])+# Sections */),
    _remove_metadata_header: (_) =>
      token(/\r?\n(?:[ \t]*\r?\n)*(?:\t|[ \t][ \t])+# Remove Metadata */),
    _remove_sections_header: (_) =>
      token(/\r?\n(?:[ \t]*\r?\n)*(?:\t|[ \t][ \t])+# Remove Sections */),

    // =========================================================================
    // Field definitions (for schema metadata blocks)
    // =========================================================================

    field_definition: ($) =>
      seq(
        $._field_line_start,
        optional($.optional_marker),
        ":",
        field("type", $.type_expression),
        optional(seq("=", field("default", $.default_value))),
        optional(seq(";", field("description", $.description))),
      ),

    // Newline + indent + field name (aliased to field_name in AST)
    _field_line_start: ($) => alias($._field_name_token, $["field_name"]),
    _field_name_token: (_) => token(/\r?\n(?:\t|[ \t][ \t])+[a-z][a-zA-Z0-9\-_]*/),

    optional_marker: (_) => "?",
    description: (_) => token(/"[^"]*"/),

    // =========================================================================
    // Section definitions (for schema sections blocks)
    // =========================================================================

    // Section names start uppercase, may contain spaces: "Key Takeaways"
    section_definition: ($) =>
      seq(
        $._section_line_start,
        optional($.optional_marker),
        optional(seq(";", field("description", $.description))),
      ),

    // Newline + indent + section name (aliased to section_name in AST)
    _section_line_start: ($) => alias($._section_name_token, $["section_name"]),
    _section_name_token: (_) => token(/\r?\n(?:\t|[ \t][ \t])+[A-Z][a-zA-Z0-9]*( +[a-zA-Z0-9]+)*/),

    // =========================================================================
    // Removals (for alter-entity)
    // =========================================================================

    field_removal: ($) =>
      seq($._field_line_start, optional(seq(";", field("reason", $.description)))),
    section_removal: ($) =>
      seq($._section_line_start, optional(seq(";", field("reason", $.description)))),

    // =========================================================================
    // Type expressions (for field definitions)
    // =========================================================================

    type_expression: ($) => choice($.union_type, $._type_term),
    union_type: ($) => prec.left(1, seq($._type_term, repeat1(seq("|", $._type_term)))),
    _type_term: ($) => choice($.array_type, $.primitive_type, $.literal_type),
    array_type: ($) => seq(choice($.primitive_type, $.literal_type), token.immediate("[]")),
    primitive_type: (_) => choice("string", "date", "date-range", "link"),
    literal_type: (_) => token(/"[^"]*"/),
    default_value: ($) => choice($.literal_type, $._plain_default),
    _plain_default: (_) => token(/[^\s;][^;\r\n]*/),

    // =========================================================================
    // Content (markdown body for instance entries)
    // =========================================================================

    // Content must start with a markdown header (# Section Name)
    content: ($) =>
      prec.right(
        seq(
          repeat($["_content_blank"]),
          $.markdown_header,
          repeat(choice($.markdown_header, $.content_line, $["_content_blank"])),
        ),
      ),

    // prec(2) for headers vs prec(1) for content lines (headers win when line starts with #)
    markdown_header: ($) => prec.right(2, seq($["_indent"], $.md_indicator, $.md_heading_text)),
    content_line: ($) => prec.right(1, seq($["_indent"], $.content_text)),

    md_indicator: (_) => token.immediate(/#+/),
    md_heading_text: (_) => token.immediate(/ [^\r\n]+/),
    content_text: (_) => token.immediate(/[^#\r\n][^\r\n]*/), // Must not start with # (would be header)

    // =========================================================================
    // Common tokens
    // =========================================================================

    _nl: (_) => /\r?\n/,
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
