/**
 * @file scanner.c
 * @brief External scanner for tree-sitter-thalo parser
 *
 * This file implements an external scanner for the thalo language parser.
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
enum TokenType
{
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
typedef struct
{
    // Reserved for future use if we need state
    uint8_t _reserved;
} Scanner;

/**
 * @brief Advance the lexer to the next character (include in parse result)
 */
static inline void advance(TSLexer *lexer)
{
    lexer->advance(lexer, false);
}

/**
 * @brief Check if character is a newline
 */
static inline bool is_newline(int32_t c)
{
    return c == '\n' || c == '\r';
}

/**
 * @brief Check if character is horizontal whitespace (space or tab)
 */
static inline bool is_hspace(int32_t c)
{
    return c == ' ' || c == '\t';
}

/**
 * @brief Check if we're in error recovery mode
 *
 * During error recovery, all symbols are marked valid. We detect this
 * by checking if the error sentinel is valid.
 */
static bool in_error_recovery(const bool *valid_symbols)
{
    return valid_symbols[ERROR_SENTINEL];
}

/**
 * @brief Check if a line has valid indentation
 *
 * Valid indentation is at least 1 space or at least 1 tab.
 */
static bool has_valid_indent(int indent, bool has_tab)
{
    return has_tab || indent >= 1;
}

/**
 * @brief Consume a newline sequence (\n or \r\n)
 */
static void consume_newline(TSLexer *lexer)
{
    bool was_cr = lexer->lookahead == '\r';
    advance(lexer);
    if (was_cr && lexer->lookahead == '\n')
    {
        advance(lexer);
    }
}

/**
 * @brief Count indentation (spaces/tabs) and advance past it
 *
 * Returns the indent count and sets has_tab if a tab was found.
 */
static int consume_indentation(TSLexer *lexer, bool *has_tab)
{
    int indent = 0;
    *has_tab = false;

    while (is_hspace(lexer->lookahead))
    {
        if (lexer->lookahead == '\t')
        {
            *has_tab = true;
        }
        indent++;
        advance(lexer);
    }

    return indent;
}

/**
 * @brief Skip to end of line (past comment content)
 */
static void skip_to_eol(TSLexer *lexer)
{
    while (!is_newline(lexer->lookahead) && !lexer->eof(lexer))
    {
        advance(lexer);
    }
}

/**
 * @brief Look ahead past comment(s) to see if indented content follows
 *
 * Called when we're at '//' (already advanced past first '/').
 * Returns true if there's indented content after the comment(s).
 */
static bool look_ahead_for_indented_content(TSLexer *lexer)
{
    // Skip rest of current comment line
    skip_to_eol(lexer);

    while (!lexer->eof(lexer))
    {
        if (!is_newline(lexer->lookahead))
            break;

        consume_newline(lexer);

        bool next_has_tab = false;
        int next_indent = consume_indentation(lexer, &next_has_tab);

        if (is_newline(lexer->lookahead) || lexer->eof(lexer))
        {
            // Blank line, continue looking
            continue;
        }

        // Check if this is another unindented comment
        if (next_indent == 0 && !next_has_tab && lexer->lookahead == '/')
        {
            advance(lexer);
            if (lexer->lookahead == '/')
            {
                // Another unindented comment, skip it and continue
                skip_to_eol(lexer);
                continue;
            }
            // Single slash at start of line - not a comment, not indented
            return false;
        }

        // Found non-blank, non-comment content
        return has_valid_indent(next_indent, next_has_tab);
    }

    // EOF without finding indented content
    return false;
}

/**
 * @brief Skip horizontal whitespace without including it in the token
 *
 * Tree-sitter extras are not consumed before external scanners are called,
 * so we need to manually skip trailing whitespace to find the newline.
 */
static void skip_hspace(TSLexer *lexer)
{
    while (is_hspace(lexer->lookahead))
    {
        lexer->advance(lexer, true); // true = skip (don't include in token)
    }
}

/**
 * @brief Unified newline scanner
 *
 * This function handles both INDENT and CONTENT_BLANK in a single pass
 * to avoid advancing the lexer before knowing what token to produce.
 *
 * Algorithm:
 * 0. Skip any trailing horizontal whitespace (extras aren't auto-consumed for externals)
 * 1. Consume the initial newline
 * 2. Count indentation on the current line
 * 3. If we have valid indent and content: return INDENT
 * 4. If unindented comment and indented content follows: return INDENT
 * 5. If we're at end of line (blank line): look ahead for content
 *    - If indented content follows: return CONTENT_BLANK
 *    - Otherwise: return false (let grammar handle the newline)
 */
static bool scan_newline(TSLexer *lexer, const bool *valid_symbols)
{
    // Skip any trailing whitespace before the newline
    // (tree-sitter extras are not automatically consumed for external scanners)
    skip_hspace(lexer);

    // Must now be at a newline
    if (!is_newline(lexer->lookahead))
    {
        return false;
    }

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

    // Case 1: Valid indented line with content (including comments) -> INDENT
    if (!at_eol && valid_indent && valid_symbols[INDENT])
    {
        lexer->mark_end(lexer);
        lexer->result_symbol = INDENT;
        DEBUG_LOG("[SCANNER] -> INDENT\n");
        return true;
    }

    // Case 2: Unindented comment line - check if followed by indented content
    // This allows comments at column 0 to be part of an entry if more metadata follows
    if (!at_eol && indent == 0 && !has_tab && valid_symbols[INDENT] && lexer->lookahead == '/')
    {
        // Mark end here (token is just the newline, no indentation)
        lexer->mark_end(lexer);

        // Check if this is a comment and if indented content follows
        advance(lexer); // Consume first '/'
        if (lexer->lookahead == '/')
        {
            // It's a comment, look ahead past it
            if (look_ahead_for_indented_content(lexer))
            {
                lexer->result_symbol = INDENT;
                DEBUG_LOG("[SCANNER] -> INDENT (unindented comment with indented content after)\n");
                return true;
            }
        }
        // Not a comment or no indented content follows - don't match
        DEBUG_LOG("[SCANNER] -> no match (unindented comment without indented content after)\n");
        return false;
    }

    // Case 3: Blank line (or whitespace-only line)
    // Only match if content follows AND CONTENT_BLANK is valid
    if (at_eol && valid_symbols[CONTENT_BLANK])
    {
        // Mark the end after this blank line
        lexer->mark_end(lexer);

        // Look ahead to see if indented content follows
        while (is_newline(lexer->lookahead))
        {
            consume_newline(lexer);

            // Count indent on this next line
            bool next_has_tab = false;
            int next_indent = consume_indentation(lexer, &next_has_tab);

            // Check what's on this line
            if (!is_newline(lexer->lookahead) && !lexer->eof(lexer))
            {
                // Found a line with content
                if (has_valid_indent(next_indent, next_has_tab))
                {
                    // Indented content follows - match CONTENT_BLANK
                    lexer->result_symbol = CONTENT_BLANK;
                    DEBUG_LOG("[SCANNER] -> CONTENT_BLANK (indented content follows)\n");
                    return true;
                }
                else
                {
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

/**
 * @brief Main scanning function
 *
 * Attempts to recognize external tokens based on what's valid at this position.
 */
static bool scan(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols)
{
    (void)scanner; // Currently unused

    DEBUG_LOG("[SCANNER] called: lookahead='%c'(%d) valid=[%d,%d,%d]\n",
              lexer->lookahead > 31 && lexer->lookahead < 127
                  ? (char)lexer->lookahead
                  : '?',
              lexer->lookahead, valid_symbols[INDENT], valid_symbols[CONTENT_BLANK],
              valid_symbols[ERROR_SENTINEL]);

    // Don't produce tokens during error recovery
    if (in_error_recovery(valid_symbols))
    {
        DEBUG_LOG("[SCANNER] error recovery mode, returning false\n");
        return false;
    }

    // Only scan if we might want INDENT or CONTENT_BLANK
    if (valid_symbols[INDENT] || valid_symbols[CONTENT_BLANK])
    {
        return scan_newline(lexer, valid_symbols);
    }

    return false;
}

/**
 * @brief Create a new scanner instance
 */
void *tree_sitter_thalo_external_scanner_create(void)
{
    Scanner *scanner = ts_calloc(1, sizeof(Scanner));
    return scanner;
}

/**
 * @brief Destroy scanner instance and free memory
 */
void tree_sitter_thalo_external_scanner_destroy(void *payload)
{
    Scanner *scanner = (Scanner *)payload;
    ts_free(scanner);
}

/**
 * @brief Serialize scanner state
 *
 * Currently stateless, so nothing to serialize.
 */
unsigned tree_sitter_thalo_external_scanner_serialize(void *payload,
                                                      char *buffer)
{
    (void)payload;
    (void)buffer;
    return 0;
}

/**
 * @brief Deserialize scanner state
 *
 * Currently stateless, so nothing to deserialize.
 */
void tree_sitter_thalo_external_scanner_deserialize(void *payload,
                                                    const char *buffer,
                                                    unsigned length)
{
    (void)payload;
    (void)buffer;
    (void)length;
}

/**
 * @brief Main entry point for token scanning
 */
bool tree_sitter_thalo_external_scanner_scan(void *payload, TSLexer *lexer,
                                             const bool *valid_symbols)
{
    Scanner *scanner = (Scanner *)payload;
    return scan(scanner, lexer, valid_symbols);
}
