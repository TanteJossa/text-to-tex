export function tokenize(text) {
    const tokens = [];
    const length = text.length;
    let i = 0;

    while (i < length) {
        const char = text[i];

        // Handle numbers
        const numberMatch = text.slice(i).match(/^\d+(\.\d+)?([eE][+-]?\d+)?/);
        if (numberMatch) {
            tokens.push({ type: 'number', value: numberMatch[0] });
            i += numberMatch[0].length;
            continue;
        }

        // Handle escaped characters
        if (char === '\\') {
            const escapeMatch = text.slice(i).match(/^\\[a-zA-Z0-9]+/);
            if (escapeMatch) {
                tokens.push({ type: 'variable', value: escapeMatch[0] });
                i += escapeMatch[0].length;
                continue;
            } else if (text[i + 1] === '{') {
                tokens.push({ type: 'variable', value: '\\{' });
                i += 2;
                continue;
            } else if (text[i + 1] === '}') {
                tokens.push({ type: 'variable', value: '\\}' });
                i += 2;
                continue;
            }
        }

        // Handle operators
        const operatorMatch = text.slice(i).match(/^[\+\-\*\/\^_]/);
        if (operatorMatch) {
            tokens.push({ type: 'operator', value: operatorMatch[0] });
            i += operatorMatch[0].length;
            continue;
        }

        // Handle special functions
        const specialFunctionMatch = text.slice(i).match(/^(sin|cos|log|ln|sum|int|sqrt|abs|arccos|arcsin|arctan|arg|cosh|cot|coth|csc|deg|det|dim|exp|gcd|hom|inf|ker|lg|lim|liminf|limsup|max|min|Pr|sec|sinh|sup|tan|tanh)\{/);
        if (specialFunctionMatch) {
            const functionName = specialFunctionMatch[1];
            const subEq = [];
            let braceCount = 1;
            let braceContent = '';
            i += specialFunctionMatch[0].length;

            while (braceCount != 0 && i < length) {
                const braceChar = text[i];
                console.log(braceChar)
                if (braceChar === '{') {
                    braceCount++;
                } else if (braceChar === '}') {
                    braceCount--;
                } 
                if (braceCount > 0) {
                    braceContent += braceChar;
                }
                i++;
                if (braceCount === 0) {
                    subEq.push(tokenize(braceContent));
                    
                    if (text[i] !== '{'){
                    
                        break;
                    } else {
                        i++
                        braceCount = 1
                        braceContent = ''
                    }
                }
            }
            tokens.push({ type: 'function', name: functionName, sub_eq: subEq });
            continue;
        }

        // Handle curly braces
        if (char === '{') {
            let braceContent = '';
            let braceCount = 1;
            i++;

            while (i < length) {
                const braceChar = text[i];
                if (braceChar === '{') {
                    braceCount++;
                } else if (braceChar === '}') {
                    braceCount--;
                }
                if (braceCount > 0) {
                    braceContent += braceChar;
                }
                i++;
                if (braceCount === 0) {
                    
                    tokens.push({ type: 'sub_eq', type: 'braces', blocks: tokenize(braceContent) });
                    
                    break;
                }
            }
            continue;
        }

        // Handle square brackets
        if (char === '[') {
            let bracketContent = '';
            let bracketCount = 1;
            i++;

            while (i < length) {
                const bracketChar = text[i];
                if (bracketChar === '[') {
                    bracketCount++;
                } else if (bracketChar === ']') {
                    bracketCount--;
                }
                if (bracketCount > 0) {
                    bracketContent += bracketChar;
                }
                i++;
                if (bracketCount === 0) {
                    tokens.push({ type: 'sub_eq', type: 'brackets', blocks: tokenize(bracketContent), is_unit: true });
                    break;
                }
            }
            continue;
        }

        // Handle equal signs and other operators
        const operatorMatch2 = text.slice(i).match(/^(=|<=|>=|<|>|\\neq|\\or|\\vee|\\and|\\wedge)/);
        if (operatorMatch2) {
            tokens.push({ type: 'operator', value: operatorMatch2[0] });
            i += operatorMatch2[0].length;
            continue;
        }

        // Handle text blocks
        if (char === '"') {
            let textBlock = '';
            let escape = false;
            i++;
            while (i < length) {
                const textChar = text[i];
                if (textChar === '\\' && !escape) {
                    escape = true;
                } else {
                    if (textChar === '"' && !escape) {
                        i++;
                        tokens.push({ type: 'text', value: textBlock });
                        break;
                    } else {
                        textBlock += textChar;
                        escape = false;
                    }
                }
                i++;
            }
            continue;
        }

        // Handle spaces
        if (/\s/.test(char)) {
            tokens.push({ type: 'whitespace', value: char });
            i++;
            continue;
        }

        // Handle anything else as a variable
        const variableMatch = text.slice(i).match(/^[a-zA-Z]+[a-zA-Z0-9'\{\}]*/);
        if (variableMatch) {
            tokens.push({ type: 'variable', value: variableMatch[0] });
            i += variableMatch[0].length;
            continue;
        }

        // Handle anything else as a variable
        tokens.push({ type: 'variable', value: char });
        i++;
    }
    return tokens;
}

// Test cases
function runTests() {
    const tests = [
        { input: "123", expected: [{ type: 'number', value: '123' }] },
        { input: "123.123", expected: [{ type: 'number', value: '123.123' }] },
        { input: "123,123E-2", expected: [{ type: 'number', value: '123' }, { type: 'variable', value: ',' }, { type: 'number', value: '123E-2' }] },
        { input: "f", expected: [{ type: 'variable', value: 'f' }] },
        { input: "f'", expected: [{ type: 'variable', value: "f'" }] },
        { input: "f\\{a", expected: [{ type: 'variable', value: "f" }, { type: 'variable', value: '\\{' }, { type: 'variable', value: 'a' }] },
        { input: "f\\pi", expected: [{ type: 'variable', value: "f\\pi" }] },
        { input: "sin{x}", expected: [{ type: 'function', name: 'sin', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "cos{x}", expected: [{ type: 'function', name: 'cos', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "log{x}", expected: [{ type: 'function', name: 'log', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "ln{x}", expected: [{ type: 'function', name: 'ln', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "sum{x}{y}{z}", expected: [{ type: 'function', name: 'sum', sub_eq: [{ type: 'variable', value: 'x' }, { type: 'variable', value: 'y' }, { type: 'variable', value: 'z' }] }] },
        { input: "int{x}{y}{z}", expected: [{ type: 'function', name: 'int', sub_eq: [{ type: 'variable', value: 'x' }, { type: 'variable', value: 'y' }, { type: 'variable', value: 'z' }] }] },
        { input: "sqrt{x}", expected: [{ type: 'function', name: 'sqrt', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "abs{x}", expected: [{ type: 'function', name: 'abs', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "a + b", expected: [{ type: 'variable', value: 'a' }, { type: 'whitespace', value: ' ' }, { type: 'operator', value: '+' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 'b' }] },
        { input: "a - b", expected: [{ type: 'variable', value: 'a' }, { type: 'whitespace', value: ' ' }, { type: 'operator', value: '-' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 'b' }] },
        { input: "a * b", expected: [{ type: 'variable', value: 'a' }, { type: 'whitespace', value: ' ' }, { type: 'operator', value: '*' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 'b' }] },
        { input: "a / b", expected: [{ type: 'variable', value: 'a' }, { type: 'whitespace', value: ' ' }, { type: 'operator', value: '/' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 'b' }] },
        { input: "a^b", expected: [{ type: 'variable', value: 'a' }, { type: 'operator', value: '^' }, { type: 'variable', value: 'b' }] },
        { input: "a_b", expected: [{ type: 'variable', value: 'a' }, { type: 'operator', value: '_' }, { type: 'variable', value: 'b' }] },
        { input: "\"text \\\" test2\"", expected: [{ type: 'text', value: 'text " test2' }] },
        { input: "{2x}", expected: [{ type: 'sub_eq', type: 'braces', blocks: [{ type: 'number', value: '2' }, { type: 'variable', value: 'x' }] }] },
        { input: "[kg]", expected: [{ type: 'sub_eq', type: 'brackets', blocks: [{ type: 'variable', value: 'kg' }], is_unit: true }] },
        { input: "f\\pi", expected: [{ type: 'variable', value: "f\\pi" }] },
        { input: "sin{x}", expected: [{ type: 'function', name: 'sin', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "cos{x}", expected: [{ type: 'function', name: 'cos', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "log{x}", expected: [{ type: 'function', name: 'log', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "ln{x}", expected: [{ type: 'function', name: 'ln', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "sum{x}{y}{z}", expected: [{ type: 'function', name: 'sum', sub_eq: [{ type: 'variable', value: 'x' }, { type: 'variable', value: 'y' }, { type: 'variable', value: 'z' }] }] },
        { input: "int{x}{y}{z}", expected: [{ type: 'function', name: 'int', sub_eq: [{ type: 'variable', value: 'x' }, { type: 'variable', value: 'y' }, { type: 'variable', value: 'z' }] }] },
        { input: "sqrt{x}", expected: [{ type: 'function', name: 'sqrt', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "abs{x}", expected: [{ type: 'function', name: 'abs', sub_eq: [{ type: 'variable', value: 'x' }] }] },
        { input: "t t", expected: [{ type: 'variable', value: 't' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 't' }] },
        { input: "int{min}{max}{eq}", expected: [{ type: 'function', name: 'int', sub_eq: [{ type: 'variable', value: 'min' }, { type: 'variable', value: 'max' }, { type: 'variable', value: 'eq' }] }] },
        { input: "log{base}{equation}", expected: [{ type: 'function', name: 'log', sub_eq: [{ type: 'variable', value: 'base' }, { type: 'variable', value: 'equation' }] }] },
        { input: "log{equation}", expected: [{ type: 'function', name: 'log', sub_eq: [{ type: 'variable', value: 'equation' }] }] },
        { input: "a b", expected: [{ type: 'variable', value: 'a' }, { type: 'whitespace', value: ' ' }, { type: 'variable', value: 'b' }] },
    ];

    tests.forEach((test, index) => {
        const result = tokenize(test.input);
        console.log(`Test ${index + 1}:`, `${JSON.stringify(result)} === ${JSON.stringify(test.expected)}`, JSON.stringify(result) === JSON.stringify(test.expected) ? 'Passed' : 'Failed');
    });
}

// Run the tests
// runTests();

// Prompt for input
function runPrompt() {
    const inputPrompt = require('prompt-sync')();

    while (true) {
        const input = inputPrompt("Enter LaTeX expression (or type 'exit' to quit): ");
        if (input.toLowerCase() === 'exit') break;
        console.log(JSON.stringify(tokenize(input), null, 4));
    }
}

// runPrompt(); // Run the prompt

// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// import tests from '../tests.json';

// const result = tests.map(test => ({
//     input: tokenize(test.input),
// }));

// fs.writeFileSync(path.join(__dirname, 'output.json'), JSON.stringify(result, null, 4));
