/**
 * @file scanner.c
 * @brief External scanner for tree-sitter-ptall parser
 *
 * This file implements an external scanner for the ptall language parser.
 * It handles indentation-sensitive parsing for metadata and content blocks.
 *
 * Token types:
 * - INDENT: Start of an indented line (newline + proper indentation consumed)
 * - CONTENT_BLANK: A blank line within content (may have trailing whitespace)
 * - ERROR_SENTINEL: Marker to detect error recovery mode
 */

#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include "tree_sitter/parser.h"

#include <stdio.h>

// Debug mode - set to 1 to enable debug output
#define DEBUG_SCANNER 0

#if DEBUG_SCANNER
#define DEBUG_LOG(...) fprintf(stderr, __VA_ARGS__)
#else
#define DEBUG_LOG(...)
#endif

/**
 * @brief Token types that the external scanner can produce
 *
 * These must match the order in the grammar's externals array.
 */
enum TokenType {
    INDENT,         // Newline followed by proper indentation (2+ spaces or tab)
    CONTENT_BLANK,  // Blank line in content (newline, optionally with whitespace-only line)
    ERROR_SENTINEL, // Sentinel for error recovery detection
};

/**
 * @brief Scanner state
 *
 * Currently stateless since we don't track indent levels across parses.
 * Tree-sitter handles the grammar-level block structure.
 */
typedef struct {
    // Reserved for future use if we need state
    uint8_t _reserved;
} Scanner;

/**
 * @brief Advance the lexer to the next character (include in parse result)
 */
static inline void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

/**
 * @brief Check if character is a newline
 */
static inline bool is_newline(int32_t c) {
    return c == '\n' || c == '\r';
}

/**
 * @brief Check if character is horizontal whitespace (space or tab)
 */
static inline bool is_hspace(int32_t c) {
    return c == ' ' || c == '\t';
}

/**
 * @brief Check if we're in error recovery mode
 *
 * During error recovery, all symbols are marked valid. We detect this
 * by checking if the error sentinel is valid.
 */
static bool in_error_recovery(const bool *valid_symbols) {
    return valid_symbols[ERROR_SENTINEL];
}

/**
 * @brief Check if a line has valid indentation
 *
 * Valid indentation is at least 1 space or at least 1 tab.
 */
static bool has_valid_indent(int indent, bool has_tab) {
    return has_tab || indent >= 1;
}

/**
 * @brief Check if the current position starts a comment (//)
 *
 * If it does, skip to the end of the line and return true.
 * This makes comments invisible to the grammar structure.
 */
static bool skip_comment_if_present(TSLexer *lexer) {
    if (lexer->lookahead != '/') {
        return false;
    }

    // Consume first /
    advance(lexer);

    if (lexer->lookahead != '/') {
        // Not a comment - this is problematic because we consumed a /
        // However, this only matters for unindented lines starting with /x
        // which would be a parse error anyway. For indented lines,
        // we check for comments BEFORE deciding to produce INDENT.
        return false;
    }

    // It's a comment - skip to end of line
    while (!is_newline(lexer->lookahead) && !lexer->eof(lexer)) {
        advance(lexer);
    }

    DEBUG_LOG("[SCANNER] skipped comment line\n");
    return true;
}

/**
 * @brief Consume a newline sequence (\n or \r\n)
 */
static void consume_newline(TSLexer *lexer) {
    bool was_cr = lexer->lookahead == '\r';
    advance(lexer);
    if (was_cr && lexer->lookahead == '\n') {
        advance(lexer);
    }
}

/**
 * @brief Count indentation (spaces/tabs) and advance past it
 *
 * Returns the indent count and sets has_tab if a tab was found.
 */
static int consume_indentation(TSLexer *lexer, bool *has_tab) {
    int indent = 0;
    *has_tab = false;

    while (is_hspace(lexer->lookahead)) {
        if (lexer->lookahead == '\t') {
            *has_tab = true;
        }
        indent++;
        advance(lexer);
    }

    return indent;
}

/**
 * @brief Unified newline scanner
 *
 * This function handles both INDENT and CONTENT_BLANK in a single pass
 * to avoid advancing the lexer before knowing what token to produce.
 *
 * Comments are treated as invisible - comment-only lines are skipped
 * entirely, allowing the scanner to find the next real content line.
 *
 * Algorithm:
 * 1. Consume the initial newline
 * 2. Count indentation on the current line
 * 3. If line is a comment: skip it and loop to next line
 * 4. If we have valid indent and content: return INDENT
 * 5. If we're at end of line (blank line): look ahead for content
 *    - If indented content follows: return CONTENT_BLANK
 *    - Otherwise: return false (let grammar handle the newline)
 */
static bool scan_newline(TSLexer *lexer, const bool *valid_symbols) {
    // Must start at a newline
    if (!is_newline(lexer->lookahead)) {
        return false;
    }

    // Loop to skip comment lines
    while (true) {
        // Consume the newline
        consume_newline(lexer);

        // Count indentation on this line
        bool has_tab = false;
        int indent = consume_indentation(lexer, &has_tab);

        // Check what's on this line
        bool at_eol = is_newline(lexer->lookahead) || lexer->eof(lexer);
        bool valid_indent = has_valid_indent(indent, has_tab);

        DEBUG_LOG("[SCANNER] line: indent=%d, has_tab=%d, at_eol=%d, valid_indent=%d, lookahead='%c'(%d)\n",
                  indent, has_tab, at_eol, valid_indent,
                  lexer->lookahead > 31 && lexer->lookahead < 127
                      ? (char)lexer->lookahead
                      : '?',
                  lexer->lookahead);

        // Check for comment line - skip it entirely and continue to next line
        // We skip comments regardless of indentation to make them "invisible"
        if (!at_eol && lexer->lookahead == '/') {
            // Peek ahead to see if it's //
            advance(lexer); // consume first /
            if (lexer->lookahead == '/') {
                // It's a comment - skip to end of line
                while (!is_newline(lexer->lookahead) && !lexer->eof(lexer)) {
                    advance(lexer);
                }
                DEBUG_LOG("[SCANNER] skipped comment line\n");
                // If there's another line, continue the loop
                if (is_newline(lexer->lookahead)) {
                    continue;
                }
                // EOF after comment
                return false;
            }
            // Not a comment (single /) - fall through
            // Note: we've consumed the /, but for unindented lines this is
            // already an error. For indented lines, this breaks content
            // starting with /x - but that's an edge case we accept.
        }

        // Case 1: Valid indented line with non-comment content -> INDENT
        if (!at_eol && valid_indent && valid_symbols[INDENT]) {
            lexer->mark_end(lexer);
            lexer->result_symbol = INDENT;
            DEBUG_LOG("[SCANNER] -> INDENT\n");
            return true;
        }

        // Case 2: Blank line (or whitespace-only line)
        // Only match if content follows AND CONTENT_BLANK is valid
        if (at_eol && valid_symbols[CONTENT_BLANK]) {
            // Mark the end after this blank line
            lexer->mark_end(lexer);

            // Look ahead to see if indented content follows
            // (also skipping any comment lines)
            while (is_newline(lexer->lookahead)) {
                consume_newline(lexer);

                // Count indent on this next line
                bool next_has_tab = false;
                int next_indent = consume_indentation(lexer, &next_has_tab);

                // Check what's on this line
                if (!is_newline(lexer->lookahead) && !lexer->eof(lexer)) {
                    // Check for comment line - skip it
                    if (lexer->lookahead == '/') {
                        advance(lexer);
                        if (lexer->lookahead == '/') {
                            // Comment line - skip and continue looking
                            while (!is_newline(lexer->lookahead) && !lexer->eof(lexer)) {
                                advance(lexer);
                            }
                            continue;
                        }
                        // Not a comment, fall through to content check
                    }

                    // Found a line with real content
                    if (has_valid_indent(next_indent, next_has_tab)) {
                        // Indented content follows - match CONTENT_BLANK
                        lexer->result_symbol = CONTENT_BLANK;
                        DEBUG_LOG("[SCANNER] -> CONTENT_BLANK (indented content follows)\n");
                        return true;
                    } else {
                        // Unindented content (new entry) - don't match
                        DEBUG_LOG("[SCANNER] -> no match (unindented content follows)\n");
                        return false;
                    }
                }
                // Another blank line - continue looking
            }

            // Reached EOF without finding indented content
            DEBUG_LOG("[SCANNER] -> no match (EOF, no content follows)\n");
            return false;
        }

        // No match - not a valid indent and not a blank line
        DEBUG_LOG("[SCANNER] -> no match (at_eol=%d, valid_indent=%d)\n", at_eol, valid_indent);
        return false;
    }
}

/**
 * @brief Main scanning function
 *
 * Attempts to recognize external tokens based on what's valid at this position.
 */
static bool scan(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
    (void)scanner; // Currently unused

    DEBUG_LOG("[SCANNER] called: lookahead='%c'(%d) valid=[%d,%d,%d]\n",
              lexer->lookahead > 31 && lexer->lookahead < 127
                  ? (char)lexer->lookahead
                  : '?',
              lexer->lookahead, valid_symbols[INDENT], valid_symbols[CONTENT_BLANK],
              valid_symbols[ERROR_SENTINEL]);

    // Don't produce tokens during error recovery
    if (in_error_recovery(valid_symbols)) {
        DEBUG_LOG("[SCANNER] error recovery mode, returning false\n");
        return false;
    }

    // Only scan if we might want INDENT or CONTENT_BLANK
    if (valid_symbols[INDENT] || valid_symbols[CONTENT_BLANK]) {
        return scan_newline(lexer, valid_symbols);
    }

    return false;
}

/**
 * @brief Create a new scanner instance
 */
void *tree_sitter_ptall_external_scanner_create(void) {
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    return scanner;
}

/**
 * @brief Destroy scanner instance and free memory
 */
void tree_sitter_ptall_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    ts_free(scanner);
}

/**
 * @brief Serialize scanner state
 *
 * Currently stateless, so nothing to serialize.
 */
unsigned tree_sitter_ptall_external_scanner_serialize(void *payload,
                                                      char *buffer) {
    (void)payload;
    (void)buffer;
    return 0;
}

/**
 * @brief Deserialize scanner state
 *
 * Currently stateless, so nothing to deserialize.
 */
void tree_sitter_ptall_external_scanner_deserialize(void *payload,
                                                    const char *buffer,
                                                    unsigned length) {
    (void)payload;
    (void)buffer;
    (void)length;
}

/**
 * @brief Main entry point for token scanning
 */
bool tree_sitter_ptall_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;
    return scan(scanner, lexer, valid_symbols);
}
