export default grammar({
  name: "ptall",

  extras: (_) => [/ +/],

  conflicts: ($) => [[$.entry], [$.content]],

  rules: {
    source_file: ($) => repeat(choice($.entry, $._nl)),

    entry: ($) => seq($.header, $._eol, repeat($.metadata), optional($.content)),

    _nl: (_) => /\r?\n/,

    header: ($) =>
      seq(
        field("timestamp", $.timestamp),
        field("directive", $.directive),
        field("entity", $.entity),
        field("title", $.title),
        repeat(choice($.link, $.tag)),
      ),

    metadata: ($) => seq($._indent, field("key", $.key), ":", field("value", $.value), $._eol),

    content: ($) =>
      seq(
        $._nl,
        repeat($._content_blank),
        $._content_first,
        repeat(choice($.markdown_header, $.content_line, $._content_blank)),
      ),

    // First content item must be a real line (not blank)
    _content_first: ($) => choice($.markdown_header, $.content_line),

    // Blank line within content - consumed but not visible in tree
    _content_blank: ($) => $._nl,

    markdown_header: ($) => prec(2, seq($._indent, $._md_hashes, $._md_text, $._eol)),

    _md_hashes: (_) => token.immediate(/#+/),
    _md_text: (_) => token(/ [^\r\n]+/),

    content_line: ($) => prec(1, seq($._indent, $._content_text, $._eol)),

    _content_text: (_) => token(/[^#\r\n][^\r\n]*/),

    _indent: (_) => token.immediate(/ {2}/),

    _eol: (_) => /\r?\n/,

    timestamp: (_) => token(/[12]\d{3}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d/),

    directive: (_) => choice("create", "update"),

    entity: (_) => choice("lore", "opinion", "reference", "journal"),

    title: (_) => token(/"[^"]*"/),

    link: (_) => token(/\^[A-Za-z0-9\-_/.]+/),

    tag: (_) => token(/#[A-Za-z0-9\-_/.]+/),

    key: (_) => token(/[a-z][a-zA-Z0-9\-_]*/),

    value: ($) => choice(prec(1, $.link), $._quoted_string, $._plain_value),

    _quoted_string: (_) => token(/"[^"]*"/),

    _plain_value: (_) => token(/[^\r\n]+/),
  },
});
