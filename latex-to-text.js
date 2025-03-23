function tokenizeLatex(latex) {
    let tokens = [];
    let i = 0;
    const len = latex.length;

    // Helper: parse a group delimited by { and } (allowing nesting)
    function parseCurlyGroup() {
        i++; // Skip the opening {
        let content = "";
        let depth = 1;
        while (i < len && depth > 0) {
            if (latex[i] === "{") {
                depth++;
                content += latex[i];
                i++;
            } else if (latex[i] === "}") {
                depth--;
                if (depth > 0) {
                    content += latex[i];
                }
                i++;
            } else {
                content += latex[i];
                i++;
            }
        }
        // Recursively tokenize the inner content.
        return tokenizeLatex(content);
    }

    // Helper: parse a group delimited by [ and ] (allowing nesting)
    function parseSquareGroup() {
        i++; // Skip the opening [
        let content = "";
        let depth = 1;
        while (i < len && depth > 0) {
            if (latex[i] === "[") {
                depth++;
                content += latex[i];
                i++;
            } else if (latex[i] === "]") {
                depth--;
                if (depth > 0) {
                    content += latex[i];
                }
                i++;
            } else {
                content += latex[i];
                i++;
            }
        }
        return tokenizeLatex(content);
    }
    /* detectNumber scans text starting at index “start”
    and tries to pick up a token matching:
    {n digit number}
    {optional: (dot or comma) or { (dot or comma) } followed by one or more digits}
    {optional: whitespace, then "\cdot", whitespace, "10", whitespace, "^", "{", optional sign, digits, "}"}
    It returns null if the first character isn’t a digit.
    Otherwise it returns an object with { value: <token-string>, newIndex: <position after the token> } */
    function detectNumber(text, start) {
        let i = start,
            n = text.length;
        let res = "";

        // helper: returns true if ch is a digit
        function isDigit(ch) {
            return ch >= "0" && ch <= "9";
        }

        // --- Parse the integer part (must have at least one digit) ---
        let integerPart = "";
        while (i < n && isDigit(text[i])) {
            integerPart += text[i];
            i++;
        }
        if (integerPart === "") return null; // no digit found at start
        res += integerPart;

        // --- Parse optional decimal separator and fraction ---
        // We allow either a dot or comma (or a {dot/comma} form)
        let separator = "";
        let fraction = "";
        if (i < n) {
            if (text[i] === "." || text[i] === ",") {
                separator = text[i];
                i++;
                let fracStart = i;
                while (i < n && isDigit(text[i])) {
                    fraction += text[i];
                    i++;
                }
                // If no digit follows the separator, we “roll back”
                if (fraction === "") {
                    i = fracStart - 1; // back up over the separator
                    separator = "";
                }
            } else if (text[i] === "{" && i + 2 < n && (text[i + 1] === "." || text[i + 1] === ",") && text[i + 2] === "}") {
                separator = text[i + 1];
                i += 3;
                let fracStart = i;
                while (i < n && isDigit(text[i])) {
                    fraction += text[i];
                    i++;
                }
                if (fraction === "") {
                    i = fracStart - 3; // rollback the whole brace pattern
                    separator = "";
                }
            }
        }
        if (separator !== "") {
            res += separator + fraction;
        }

        // --- Look for an optional exponent part ---
        // Save where we are before “consuming” whitespace for the exponent:
        let savedIndex = i;
        while (i < n && /\s/.test(text[i])) {
            i++;
        } // skip white space

        var next_exp = "\\cdot"
        if (text.slice(i, i + next_exp.length) === next_exp) {
            let expStr = "";
            // (Include any whitespace that was skipped if you wish)
            expStr += text.slice(savedIndex, i);
            expStr += text.slice(i, i + next_exp.length); // the "\cdot"
            i += next_exp.length;
            
            
            // Skip whitespace after "\cdot"
            while (i < n && /\s/.test(text[i])) {
                expStr += text[i];
                i++;
            }


            // Expect "10"
            if (text.slice(i, i + 2) !== "10") {
                i = savedIndex; // exponent part not valid, so back out
                return {
                    value: res,
                    newIndex: i
                };
            }
            expStr += "10";
            i += 2;

            while (i < n && /\s/.test(text[i])) {
                expStr += text[i];
                i++;
            }
            // Expect a caret '^'
            if (i < n && text[i] === "^") {
                expStr += "^";
                i++;
            } else {
                i = savedIndex;
                return {
                    value: res,
                    newIndex: i
                };
            }
            // Expect an opening brace '{'
            if (i < n && text[i] === "{") {
                expStr += "{";
                i++;
            } else {
                i = savedIndex;
                return {
                    value: res,
                    newIndex: i
                };
            }
            // Read an exponent number: optional "+" or "-" then at least one digit
            let expDigits = "";
            if (i < n && (text[i] === "+" || text[i] === "-")) {
                expDigits += text[i];
                expStr += text[i];
                i++;
            }
            if (i < n && isDigit(text[i])) {
                while (i < n && isDigit(text[i])) {
                    expDigits += text[i];
                    expStr += text[i];
                    i++;
                }
            } else {
                i = savedIndex;
                return {
                    value: res,
                    newIndex: i
                };
            }
            // Expect a closing brace '}'
            if (i < n && text[i] === "}") {
                expStr += "}";
                i++;
            } else {
                i = savedIndex;
                return {
                    value: res,
                    newIndex: i
                };
            }
            // Append the valid exponent part:
            res += expStr;
        } else {
            // No exponent part: revert to savedIndex so that any whitespace skipped isn’t “eaten”
            i = savedIndex;
        }

        return {
            value: res,
            newIndex: i
        };
    }

    /* convertToScientificFormat takes one of the tokens produced by detectNumber
    and returns a converted version:
    • When there is no exponent part, it replaces any dot with a comma.
    • When an exponent was found (look for "\cdot"), it extracts the exponent number
    and returns:  {base} + "E" + {exponent number}

    Examples:
    "3"                → "3"
    "3,4"              → "3,4"
    "3{,}4" (detected as "3,4") → "3,4"
    "10.10"            → "10,10"
    "10.10 \cdot 10^{-10}"  → "10.10E-10"
    */
    function convertToScientificFormat(numStr) {
        if (numStr == null) return null;
        // If there is an exponent part, look for "\cdot"
        if (numStr.indexOf("\\cdot") !== -1) {
            // Let the base be what comes before "\cdot":
            let base = numStr.slice(0, numStr.indexOf("\\cdot")).trim();
            // In the exponent part we expect a pattern like: "\cdot 10^{...}"
            // We simply locate the first "{" and the last "}" and extract what is between.
            let braceOpen = numStr.indexOf("{");
            let braceClose = numStr.lastIndexOf("}");
            if (braceOpen !== -1 && braceClose !== -1 && braceClose > braceOpen) {
                let exponent = numStr.substring(braceOpen + 1, braceClose);
                return base + "E" + exponent;
            } else {
                return numStr; // not as expected; return the original string
            }
        } else {
            // No exponent part: simply change every dot into a comma.
            // (If you want to change only the first occurrence, you might use replace; here we convert all.)
            return numStr.split(".").join(",");
        }
    }


    // Main loop: iterate through the LaTeX string
    while (i < len) {
        let ch = latex[i];

        // Handle whitespace (we preserve it as its own tokens)
        if (/\s/.test(ch)) {
            tokens.push({
                type: "whitespace",
                value: ch
            });
            i++;
            continue;
        }

        // Special: division formatted as \dfrac{numerator}{denominator}
        if (latex.slice(i).startsWith("\\dfrac")) {
            i += "\\dfrac".length;
            // Skip any intervening whitespace
            while (i < len && /\s/.test(latex[i])) {
                i++;
            }
            let numerator = [];
            if (latex[i] === "{") {
                numerator = parseCurlyGroup();
            }
            while (i < len && /\s/.test(latex[i])) {
                i++;
            }
            let denominator = [];
            if (latex[i] === "{") {
                denominator = parseCurlyGroup();
            }
            tokens.push({
                type: "operator",
                value: "/",
                numerator: numerator,
                denominator: denominator
            });
            continue;
        }

        // Special: multiplication formatted as \cdot (our forward conversion uses it for '*')
        if (latex.slice(i).startsWith("\\cdot")) {
            tokens.push({
                type: "operator",
                value: "*"
            });
            i += "\\cdot".length;
            continue;
        }

        // Special: text block formatted as \text{...}
        if (latex.slice(i).startsWith("\\text{")) {
            i += "\\text{".length;
            let textContent = "";
            let depth = 1;
            while (i < len && depth > 0) {
                if (latex[i] === "{") {
                    depth++;
                    textContent += latex[i];
                    i++;
                } else if (latex[i] === "}") {
                    depth--;
                    if (depth > 0) {
                        textContent += latex[i];
                    }
                    i++;
                } else {
                    textContent += latex[i];
                    i++;
                }
            }
            tokens.push({
                type: "text",
                value: textContent
            });
            continue;
        }

        // Special: functions – they start with a backslash followed by alphabetic letters.
        if (ch === "\\") {
            let funcMatch = latex.slice(i).match(/^\\[a-zA-Z]+/);
            if (funcMatch) {
                let fullCmd = funcMatch[0];
                let funcName = fullCmd.slice(1); // remove the backslash

                // List of special functions as defined in the formatting instructions.
                let specialFunctions = [
                    "sin", "cos", "log", "ln", "sum", "int", "sqrt", "abs",
                    "arcsin", "arctan", "arccos", "arg", "cos", "cosh", "cot", "coth",
                    "csc", "deg", "det", "dim", "exp", "gcd", "hom", "inf", "ker", "lg",
                    "lim", "liminf", "limsup", "max", "min", "Pr", "sec", "tan", "tanh", "sup"
                ];

                // If the command is one of our special functions, process its groups.
                if (specialFunctions.includes(funcName)) {
                    i += fullCmd.length; // Consume the function command
                    let sub_eq = [];
                    // Check for optional superscript (^) and subscript (_) groups.
                    while (i < len && (latex[i] === "_" || latex[i] === "^")) {
                        let op = latex[i];
                        i++; // consume '_' or '^'

                        if (latex[i] === "{") {
                            let groupTokens = parseCurlyGroup();
                            sub_eq.push({
                                type: op === "_" ? "subscript" : "superscript",
                                blocks: groupTokens
                            });
                        }
                    }
                    // Now, check for the main argument group (if present).
                    if (i < len && latex[i] === "{") {
                        let groupTokens = parseCurlyGroup();
                        sub_eq.push({
                            type: "argument",
                            blocks: groupTokens
                        });
                    }
                    tokens.push({
                        type: "function",
                        name: funcName,
                        sub_eq: sub_eq
                    });
                    continue;
                } else {
                    // Not a special function? Could be a special variable like \pi, or an operator command.
                    tokens.push({
                        type: "variable",
                        value: fullCmd
                    });
                    i += fullCmd.length;
                    continue;
                }
            }
        }

        // If we see an opening curly brace, treat it as a subequation wrapped in braces.
        if (ch === "{") {
            let groupTokens = parseCurlyGroup();
            tokens.push({
                type: "braces",
                blocks: groupTokens
            });
            continue;
        }

        // If we see an opening square bracket, that indicates a unit/tags group.
        if (ch === "[") {
            let groupTokens = parseSquareGroup();
            tokens.push({
                type: "brackets",
                blocks: groupTokens,
                is_unit: true
            });
            continue;
        }

        // Check for numbers.
        // Expected pattern: one or more digits, optionally with a "{,}" as a decimal separator,
        // and optionally an exponent formatted as " \cdot 10^{...}".
        const response = detectNumber(latex, i);

        if (response) {
            tokens.push({
                type: "number",
                value: convertToScientificFormat(response.value)
            });
            i = response.newIndex;
            continue;
        }


        // Check for equallike operators – note the multi‐character operators are prioritized.
        const opList = ["<=", ">=", "\\neq", "\\or", "\\vee", "\\and", "\\wedge", "=", "<", ">", "+", "-", "*", "/", "^", "_"];
        let opFound = false;
        for (let op of opList) {
            if (latex.slice(i, i + op.length) === op) {
                tokens.push({
                    type: "operator",
                    value: op
                });
                i += op.length;
                opFound = true;
                break;
            }
        }
        if (opFound) continue;

        // Otherwise, treat contiguous letters/digits (and apostrophes, backslashes) as a variable.
        let varMatch = latex.slice(i).match(/^[a-zA-Z0-9'\\]+/);
        if (varMatch) {
            tokens.push({
                type: "variable",
                value: varMatch[0]
            });
            i += varMatch[0].length;
            continue;
        }

        // If nothing else matches, push the single character as a variable token.
        tokens.push({
            type: "variable",
            value: ch
        });
        i++;
    }
    return tokens;
}

const tests = [
    // 1. Simple number
    {
        input: "123",
        expected: [{
            type: "number",
            value: "123"
        }]
    },
    // 2. Number with {,} decimal part
    {
        input: "123{,}456",
        expected: [{
            type: "number",
            value: "123{,}456"
        }]
    },
    // 3. Number with exponent (no extra space)
    {
        input: "123\cdot10^{3}",
        expected: [{
            type: "number",
            value: "123\cdot10^{3}"
        }]
    },
    // 4. Number with decimal and exponent
    {
        input: "123{,}456\cdot10^{3}",
        expected: [{
            type: "number",
            value: "123{,}456\cdot10^{3}"
        }]
    },
    // 5. Basic \text case
    {
        input: "\text{cases}",
        expected: [{
            type: "text",
            value: "cases"
        }]
    },
    // 6. \text with nested inner braces
    {
        input: "\text{a string with {braces} inside}",
        expected: [{
            type: "text",
            value: "a string with {braces} inside"
        }]
    },
    // 7. \dfrac with simple numbers
    {
        input: "\dfrac{1}{2}",
        expected: [{
            type: "operator",
            value: "/",
            numerator: [{
                type: "number",
                value: "1"
            }],
            denominator: [{
                type: "number",
                value: "2"
            }]
        }]
    },
    // 8. \cdot for multiplication
    {
        input: "\cdot",
        expected: [{
            type: "operator",
            value: ""
        }]
    },
    // 9. A simple function with argument
    {
        input: "\sin{x}",
        expected: [{
            type: "function",
            name: "sin",
            sub_eq: [{
                type: "argument",
                blocks: [{
                    type: "variable",
                    value: "x"
                }]
            }]
        }]
    },
    // 10. A function with subscript, superscript and argument
    {
        input: "\sum_{n=1}^{N}{n}",
        expected: [{
            type: "function",
            name: "sum",
            sub_eq: [{
                    type: "subscript",
                    blocks: [{
                            type: "variable",
                            value: "n"
                        },
                        {
                            type: "operator",
                            value: "="
                        },
                        {
                            type: "number",
                            value: "1"
                        }
                    ]
                },
                {
                    type: "superscript",
                    blocks: [{
                        type: "variable",
                        value: "N"
                    }]
                },
                {
                    type: "argument",
                    blocks: [{
                        type: "variable",
                        value: "n"
                    }]
                }
            ]
        }]
    },
    // 11. Variable, whitespace and a \text block inside a sentence.
    {
        input: "a \text{b {inside} text} c",
        expected: [{
                type: "variable",
                value: "a"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "text",
                value: "b {inside} text"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "c"
            }
        ]
    },
    // 12. A backslash command not in specialFunctions becomes a variable.
    {
        input: "\Fred",
        expected: [{
            type: "variable",
            value: "\Fred"
        }]
    },
    // 13. A minimal curly-brace group
    {
        input: "{x+y}",
        expected: [{
            type: "braces",
            blocks: [{
                    type: "variable",
                    value: "x"
                },
                {
                    type: "operator",
                    value: "+"
                },
                {
                    type: "variable",
                    value: "y"
                }
            ]
        }]
    },
    // 14. Brackets for units/tags.
    {
        input: "[km/s]",
        expected: [{
            type: "brackets",
            blocks: [{
                    type: "variable",
                    value: "km"
                },
                {
                    type: "operator",
                    value: "/"
                },
                {
                    type: "variable",
                    value: "s"
                }
            ],
            is_unit: true
        }]
    },
    // 15. Mixed number and variable.
    {
        input: "3x",
        expected: [{
                type: "number",
                value: "3"
            },
            {
                type: "variable",
                value: "x"
            }
        ]
    },
    // 16. Equation with whitespace and \dfrac.
    {
        input: " 123 + \dfrac{4}{5} ",
        expected: [{
                type: "whitespace",
                value: " "
            },
            {
                type: "number",
                value: "123"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "+"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "/",
                numerator: [{
                    type: "number",
                    value: "4"
                }],
                denominator: [{
                    type: "number",
                    value: "5"
                }]
            },
            {
                type: "whitespace",
                value: " "
            }
        ]
    },
    // 17. Function with no following argument.
    {
        input: "\sin",
        expected: [{
            type: "function",
            name: "sin",
            sub_eq: []
        }]
    },
    // 18. Function with a subscript only.
    {
        input: "\log_{10}",
        expected: [{
            type: "function",
            name: "log",
            sub_eq: [{
                type: "subscript",
                blocks: [{
                    type: "number",
                    value: "10"
                }]
            }]
        }]
    },
    // 19. Function with a nested curly in its argument.
    {
        input: "\sqrt{a + {b * c}}",
        expected: [{
            type: "function",
            name: "sqrt",
            sub_eq: [{
                type: "argument",
                blocks: [{
                        type: "variable",
                        value: "a"
                    },
                    {
                        type: "whitespace",
                        value: " "
                    },
                    {
                        type: "operator",
                        value: "+"
                    },
                    {
                        type: "whitespace",
                        value: " "
                    },
                    {
                        type: "braces",
                        blocks: [{
                                type: "variable",
                                value: "b"
                            },
                            {
                                type: "whitespace",
                                value: " "
                            },
                            {
                                type: "operator",
                                value: ""
                            },
                            {
                                type: "whitespace",
                                value: " "
                            },
                            {
                                type: "variable",
                                value: "c"
                            }
                        ]
                    }
                ]
            }]
        }]
    },
    // 20. Two functions separated by operators.
    {
        input: "\sin{x} + \cos{y}",
        expected: [{
                type: "function",
                name: "sin",
                sub_eq: [{
                    type: "argument",
                    blocks: [{
                        type: "variable",
                        value: "x"
                    }]
                }]
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "+"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "function",
                name: "cos",
                sub_eq: [{
                    type: "argument",
                    blocks: [{
                        type: "variable",
                        value: "y"
                    }]
                }]
            }
        ]
    },
    // 21. A variable containing a backslash and an apostrophe.
    {
        input: "a\'b",
        expected: [{
            type: "variable",
            value: "a\'b"
        }]
    },
    // 22. Curly group containing a fraction and an extra variable.
    {
        input: "{\dfrac{12}{34}+x}",
        expected: [{
            type: "braces",
            blocks: [{
                    type: "operator",
                    value: "/",
                    numerator: [{
                        type: "number",
                        value: "12"
                    }],
                    denominator: [{
                        type: "number",
                        value: "34"
                    }]
                },
                {
                    type: "operator",
                    value: "+"
                },
                {
                    type: "variable",
                    value: "x"
                }
            ]
        }]
    },
    // 23. Tabs and newlines as whitespace.
    {
        input: "\t123\n+456",
        expected: [{
                type: "whitespace",
                value: "\t"
            },
            {
                type: "number",
                value: "123"
            },
            {
                type: "whitespace",
                value: "\n"
            },
            {
                type: "operator",
                value: "+"
            },
            {
                type: "number",
                value: "456"
            }
        ]
    },
    // 24. Large number with decimal and exponent.
    {
        input: "789{,}012 \cdot 10^{34}",
        expected: [{
            type: "number",
            value: "789{,}012 \cdot 10^{34}"
        }]
    },
    // 25. Equation mixing exponents, subscripts, division, multiplication and a text block.
    {
        input: "x^2 + y_1 - \dfrac{a}{b}\cdot \text{end}",
        expected: [{
                type: "variable",
                value: "x"
            },
            {
                type: "operator",
                value: "^"
            },
            {
                type: "number",
                value: "2"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "+"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "y"
            },
            {
                type: "operator",
                value: ""
            },
            {
                type: "number",
                value: "1"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "-"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "/",
                numerator: [{
                    type: "variable",
                    value: "a"
                }],
                denominator: [{
                    type: "variable",
                    value: "b"
                }]
            },
            {
                type: "operator",
                value: "*"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "text",
                value: "end"
            }
        ]
    },
    // 26. Operators that are multi–character (<=, \neq, >=)
    {
        input: "x <= y \neq z >= 5",
        expected: [{
                type: "variable",
                value: "x"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "<="
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "y"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "\neq"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "z"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: ">="
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "number",
                value: "5"
            }
        ]
    },
    // 27. \text block whose text includes square brackets and inner braces.
    {
        input: "\text{[a {b} c]}",
        expected: [{
            type: "text",
            value: "[a {b} c]"
        }]
    },
    // 28. Nested curly groups with extra whitespace.
    {
        input: "{ {x} {\text{y}} }",
        expected: [{
            type: "braces",
            blocks: [{
                    type: "whitespace",
                    value: " "
                },
                {
                    type: "braces",
                    blocks: [{
                        type: "variable",
                        value: "x"
                    }]
                },
                {
                    type: "whitespace",
                    value: " "
                },
                {
                    type: "braces",
                    blocks: [{
                        type: "text",
                        value: "y"
                    }]
                },
                {
                    type: "whitespace",
                    value: " "
                }
            ]
        }]
    },
    // 29. Simple underscore used outside a function.
    {
        input: "a_b",
        expected: [{
                type: "variable",
                value: "a"
            },
            {
                type: "operator",
                value: ""
            },
            {
                type: "variable",
                value: "b"
            }
        ]
    },
    // 30. A long complicated expression mixing functions, fractions, text blocks and various operators.
    {
        input: " \int_0^{\infty} e^{-x} dx = \dfrac{1}{1-\text{const}{0}} ",
        expected: [{
                type: "whitespace",
                value: " "
            },
            {
                type: "function",
                name: "int",
                sub_eq: []
            },
            {
                type: "number",
                value: "0"
            },
            {
                type: "operator",
                value: "^"
            },
            {
                type: "braces",
                blocks: [{
                    type: "variable",
                    value: "\infty"
                }]
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "e"
            },
            {
                type: "operator",
                value: "^"
            },
            {
                type: "braces",
                blocks: [{
                        type: "operator",
                        value: "-"
                    },
                    {
                        type: "variable",
                        value: "x"
                    }
                ]
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "variable",
                value: "dx"
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "="
            },
            {
                type: "whitespace",
                value: " "
            },
            {
                type: "operator",
                value: "/",
                numerator: [{
                    type: "number",
                    value: "1"
                }],
                denominator: [{
                        type: "number",
                        value: "1"
                    },
                    {
                        type: "operator",
                        value: "-"
                    },
                    {
                        type: "text",
                        value: "const"
                    },
                    {
                        type: "operator",
                        value: ""
                    },
                    {
                        type: "braces",
                        blocks: [{
                                type: "operator",
                                value: ""
                            },
                            {
                                type: "number",
                                value: "0"
                            }
                        ]
                    }
                ]
            },
            {
                type: "whitespace",
                value: " "
            }
        ]
    }
];

// Run tests and log results
tests.forEach((test, index) => {
    const output = tokenizeLatex(test.input);
    const pass = JSON.stringify(output) === JSON.stringify(test.expected);
    console.log("Test #" + (index + 1));
    console.log("Input:   ", test.input);
    // console.log("Expected:", JSON.stringify(test.expected, null, 2));
    console.log("Output:  ", JSON.stringify(output, null));
    console.log("Pass:    ", pass);
    console.log("--------------------------------------------------\n");
});

function blockToText(tokens, is_sub_eq = false, is_text = null) {
    var output = "";
    var tempStr = "";


    // Flush the accumulated text (if any) into the output,
    // wrapped in square brackets.
    function flushTemp() {
        is_text = false
        if (tempStr !== "") {
            output += "[" + tempStr + "]";
            tempStr = "";

        }
    }

    const addToOutput = (text) => {
        if (is_text) {
            tempStr += text;
        } else {
            output += text;

        }
    }

    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        // If it is a text block then accumulate its conversion.
        if (token.type === "text") {
            is_text = true
            addToOutput(token.value)
        } else {
            // Before handling any non-text token, flush out any text we've accumulated.
            if (token.type === "whitespace") {
                addToOutput(token.value);
            } else if (token.type === "operator") {
                switch (token.value) {
                    case "/":
                        
                        const [num, num_is_text] = blockToText(token.numerator, true, is_text)
                        const [den, den_is_text] = blockToText(token.denominator, true, is_text)

                        if (!num_is_text || !den_is_text) {
                            flushTemp()
                        }
                        if (num_is_text && den_is_text) {
                            is_text = true
                        }

                        addToOutput("\\dfrac{" + num + "}{" + den + "}");

                        break;

                    default:
                        addToOutput(token.value);

                        break;
                }
            } else if (token.type === "variable") {
                flushTemp();
                addToOutput(token.value)
            } else if (token.type === "number") {
                let input = token.value;

                // Replace 3{,}4 \cdot 10^{-2} with 3,4E-2
                input = input.replace(/(\d+)\{,\}(\d+) \\cdot 10\^{(-?\d+)}/g, '$1,$2E$3');

                // Replace 3 \cdot 10^{-4} with 3E-4
                input = input.replace(/(\d+) \\cdot 10\^{(-?\d+)}/g, '$1E$2');

                // Replace 3{,}3 with 3,3
                input = input.replace(/(\d+)\{,\}(\d+)/g, '$1,$2');

                // Replace 3,3 with 3,3 (no change needed, but included for completeness)
                // input = input.replace(/(\d+),(\d+)/g, '$1,$2'); // This line is redundant

                // Replace 3.3 with 3.3 (no change needed, but included for completeness)
                // input = input.replace(/(\d+)\.(\d+)/g, '$1.$2'); // This line is redundant
                addToOutput(input);
            } else if (token.type === "braces") {
                // Convert inner blocks and wrap with { ... }.
                const [text, sub_eq_is_text] = blockToText(token.blocks, true)
                if (!sub_eq_is_text) {
                    flushTemp()
                }
                addToOutput("{" + text + "}")
            } else if (token.type === "brackets") {
                const [text, sub_eq_is_text] = blockToText(token.blocks, true, is_text)
                if (!sub_eq_is_text) {
                    flushTemp()
                }
                addToOutput("[" + text + "]")

                // Convert inner blocks and wrap with [ ... ]. (This is our “square braces correctly” rule.)
            } else if (token.type === "function") {
                // Convert function tokens by outputting the backslash plus name,
                // then each of its sub_equation groups.
                var funcStr = token.name;
                if (token.sub_eq && token.sub_eq.length > 0) {
                    var is_texts = []
                    token.sub_eq.forEach(function (sub) {
                        const [text, sub_eq_is_text] = blockToText(sub.blocks, true)
                        is_texts.push(sub_eq_is_text)

                        if (sub.type === "subscript") {
                            funcStr += "{" + text + "}";
                        } else if (sub.type === "superscript") {
                            funcStr += "{" + text + "}";
                        } else if (sub.type === "argument") {
                            funcStr += "{" + text + "}";
                        }
                    });
                    if (is_texts.includes(false)) {
                        flushTemp()
                    }
                }
                addToOutput(funcStr)
            } else {
                addToOutput(token.value || "")
                // Anything else: if there is some value, just output it.
            }
        }
    }
    if (!is_sub_eq) {

        // Flush any remaining accumulated text.
        flushTemp();
        return output;
    } else {

        return [output + tempStr, is_text];
    }
}

const prompt = require('prompt-sync')();
while (true) {

    var latex = prompt('Enter latex: ');
    var tokens = tokenizeLatex(latex);
    console.log(JSON.stringify(tokens, null, 2));
    console.log(blockToText(tokens))
}