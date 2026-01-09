; Timestamps - displayed as special constants
(timestamp) @number

; Directives - keywords for entry types
(data_directive) @keyword
(schema_directive) @keyword

; Entity identifier in schema definitions
(identifier) @type

; Title strings
(title) @string

; Links (^reference-id)
(link) @tag

; Tags (#category)
(tag) @attribute

; Metadata key-value pairs
(metadata
  (key) @property
  (value) @string)

; Field definitions in schema
(field_definition
  (field_name) @property
  (optional_marker)? @punctuation.special
  (type_expression) @type
  (default_value)? @string
  (description)? @comment)

; Section definitions in schema
; Using @variable instead of @label since @label isn't in most themes
(section_definition
  (section_name) @variable
  (optional_marker)? @punctuation.special
  (description)? @comment)

; Type expressions
(primitive_type) @type.builtin
(literal_type) @string
(array_type) @type

; Punctuation
":" @punctuation.delimiter
";" @punctuation.delimiter
"=" @operator
"|" @operator
"[]" @punctuation.bracket

; Markdown headers in content
(markdown_header) @markup.heading

; Content lines (regular text)
(content_line) @text

; Field/section removals
(field_removal
  (field_name) @property
  (description)? @comment)

(section_removal
  (section_name) @variable
  (description)? @comment)

; Description strings (in schema definitions)
(description) @comment

; Comments
(comment) @comment
