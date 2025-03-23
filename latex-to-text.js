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
        let numberRegex = /^\d+(?:\{,\}\d+)?(?:\s*\\cdot\s*10\^\{[^}]+\})?/;
        let numMatch = latex.slice(i).match(numberRegex);
        if (numMatch) {
            tokens.push({
                type: "number",
                value: numMatch[0]
            });
            i += numMatch[0].length;
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

// ---------- TESTS ----------

// Test 1: Simple number with decimal (the forward conversion turns 123.456 into "123{,}456")
console.log("Test 1:", JSON.stringify(tokenizeLatex("123{,}456"), null, 2));

// Test 2: Number with exponent: "123{,}456 \cdot 10^{7}"
console.log("Test 2:", JSON.stringify(tokenizeLatex("123{,}456 \cdot 10^{7}"), null, 2));

// Test 3: Division using \dfrac: "\dfrac{1}{2}"
console.log("Test 3:", JSON.stringify(tokenizeLatex("\dfrac{1}{2}"), null, 2));

// Test 4: Function without sub/superscripts, e.g., "\sin{\theta}"
console.log("Test 4:", JSON.stringify(tokenizeLatex("\sin{\theta}"), null, 2));

// Test 5: Function with subscript – e.g., "\log_{10}{100}"
console.log("Test 5:", JSON.stringify(tokenizeLatex("\log_{10}{100}"), null, 2));

// Test 6: A subequation in braces – e.g., "{2x+1}"
console.log("Test 6:", JSON.stringify(tokenizeLatex("{2x+1}"), null, 2));

// Test 7: Square brackets for unit – e.g., "[kg]"
console.log("Test 7:", JSON.stringify(tokenizeLatex("[kg]"), null, 2));

// Test 8: Special variable command – e.g., "\pi"
console.log("Test 8:", JSON.stringify(tokenizeLatex("\pi"), null, 2));

// Test 9: Equallike operators – e.g., "=<=>=\neq"
console.log("Test 9:", JSON.stringify(tokenizeLatex("= <= >= \neq"), null, 2));

// Test 10: A text block formatted with \text – e.g., "\text{Hello World}"
console.log("Test 10:", JSON.stringify(tokenizeLatex("\text{Hello World}"), null, 2));

// Test 11: Complex expression mixing many elements:
let complexLatex = "\\int_{0}^{\\infty}{e^{-x}} + \\cos{[\\pi]} = 1";
console.log("Test 11:", JSON.stringify(tokenizeLatex(complexLatex), null, 2));


const prompt = require('prompt-sync')();
while (true) {

    var latex = prompt('Enter latex: ');
    var text = tokenizeLatex(latex);
    console.log(JSON.stringify(text, null, 2));
}