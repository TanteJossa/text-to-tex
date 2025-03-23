function convertBlocksToLatex(blocks, isUnit = false) {
    if (!Array.isArray(blocks)) {
        blocks = [blocks];
    }

    const functionsWithSubscriptsAndSuperscripts = ['int', 'sum'];
    const functionsWithSubscripts = ['log'];
    const functionsWithOneSubscript = ['lim', 'liminf', 'limsup'];
    const functionsWithNoSubscripts = ['sqrt', 'abs', 'ln', 'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'arg', 'deg', 'det', 'dim', 'exp', 'gcd', 'hom', 'inf', 'ker', 'lg', 'max', 'min', 'Pr', 'sinh', 'tanh', 'coth'];

    function convertBlock(block, isUnit) {
        if (block.type === 'number') {
            let value = block.value.replace('.', ',').replace(',', '{,}');
            if (value.includes('E')) {
                const [base, exp] = value.split('E');
                return `${base} \\cdot 10^{${exp}}`;
            }
            return value;
        } else if (block.type === 'operator') {
            switch (block.value) {
                case '+':
                    return '+';
                case '-':
                    return '-';
                case '*':
                    return '\\cdot ';
                case '/':
                    return '\\dfrac{';
                default:
                    return block.value; // For equallike operators
            }
        } else if (block.type === 'variable') {
            return isUnit ? `\\text{ ${block.value.replace(/({|})/g, '\\$1')}}` : block.value.replace(/({|})/g, '\\$1');
        } else if (block.type === 'text') {
            return `\\text{${block.value}}`;
        } else if (block.type === 'braces') {
            return `{${convertBlocksToLatex(block.blocks, isUnit)}}`;
        } else if (block.type === 'brackets') {
            const unitBlocks = convertBlocksToLatex(block.blocks, true);
            return ` ${unitBlocks}`;
        } else if (block.type === 'function') {
            if (block.sub_eq) {
                const sub_eq = block.sub_eq.map(eq => convertBlocksToLatex(eq, isUnit));
                if (functionsWithSubscriptsAndSuperscripts.includes(block.name)) {
                    const first = sub_eq[sub_eq.length - 1];
                    const second = sub_eq.length > 1 ? sub_eq[sub_eq.length - 2] : null;
                    const third = sub_eq.length > 2 ? sub_eq[sub_eq.length - 3] : null;
                    return `\\${block.name}${third ? `_{${third}}` : ''}${second ? `^{${second}}` : ''} {${first}}`;
                } else if (functionsWithSubscripts.includes(block.name)) {
                    const first = sub_eq[sub_eq.length - 1];
                    const second = sub_eq.length > 1 ? sub_eq[sub_eq.length - 2] : '';
                    return `\\${block.name}${second ? `_{${second}}` : ''} {${first}}`;
                } else if (functionsWithOneSubscript.includes(block.name)) {
                    const first = sub_eq[sub_eq.length - 1];
                    const second = sub_eq.length > 1 ? sub_eq[sub_eq.length - 2] : '';
                    return `\\${block.name}${second ? `_{${second}}` : ''}({${first}})`;
                } else {
                    const first = sub_eq[sub_eq.length - 1];
                    return `\\${block.name}({${first}})`;
                }
            } else {
                return `\\${block.name}({})`;
            }
        }
        return '';
    }

    let latex = '';
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block && block.type === 'operator' && block.value === '/') {
            // Handle division specially
            const numerator = convertBlock(blocks[i - 1], isUnit);
            const denominator = convertBlock(blocks[i + 1], isUnit);
            latex = latex.slice(0, -convertBlock(blocks[i - 1], isUnit).length); // Remove the last added numerator
            latex += `\\dfrac{${numerator}}{${denominator}}`;
            i++; // Skip the denominator block
        } else if (block.type === 'whitespace') {
            // Ignore whitespace
        } else {
            latex += convertBlock(block, isUnit);
        }
    }
    return latex;
}

function tokenize(text) {
    const tokens = [];
    const length = text.length;
    let i = 0;

    while (i < length) {
        const char = text[i];

        // Handle numbers
        const numberMatch = text.slice(i).match(/^\d+(,\d+)*(\.\d+(,\d+)*)?([eE][+-]?\d+)?/);
        if (numberMatch) {
            tokens.push({
                type: 'number',
                value: numberMatch[0]
            });
            i += numberMatch[0].length;
            continue;
        }

        // Handle escaped characters
        if (char === '\\') {
            const escapeMatch = text.slice(i).match(/^\\[a-zA-Z0-9]+/);
            if (escapeMatch) {
                tokens.push({
                    type: 'variable',
                    value: escapeMatch[0]
                });
                i += escapeMatch[0].length;
                continue;
            } else if (text[i + 1] === '{') {
                tokens.push({
                    type: 'variable',
                    value: '\\{'
                });
                i += 2;
                continue;
            } else if (text[i + 1] === '}') {
                tokens.push({
                    type: 'variable',
                    value: '\\}'
                });
                i += 2;
                continue;
            }
        }

        // Handle operators
        const operatorMatch = text.slice(i).match(/^[\+\-\*\/\^_]/);
        if (operatorMatch) {
            tokens.push({
                type: 'operator',
                value: operatorMatch[0]
            });
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

                    if (text[i] !== '{') {

                        break;
                    } else {
                        i++
                        braceCount = 1
                        braceContent = ''
                    }
                }
            }
            tokens.push({
                type: 'function',
                name: functionName,
                sub_eq: subEq
            });
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

                    tokens.push({
                        type: 'sub_eq',
                        type: 'braces',
                        blocks: tokenize(braceContent)
                    });

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
                    tokens.push({
                        type: 'sub_eq',
                        type: 'brackets',
                        blocks: tokenize(bracketContent),
                        is_unit: true
                    });
                    break;
                }
            }
            continue;
        }

        // Handle equal signs and other operators
        const operatorMatch2 = text.slice(i).match(/^(=|<=|>=|<|>|\\neq|\\or|\\vee|\\and|\\wedge)/);
        if (operatorMatch2) {
            tokens.push({
                type: 'operator',
                value: operatorMatch2[0]
            });
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
                        tokens.push({
                            type: 'text',
                            value: textBlock
                        });
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
            tokens.push({
                type: 'whitespace',
                value: char
            });
            i++;
            continue;
        }

        // Handle anything else as a variable
        const variableMatch = text.slice(i).match(/^[a-zA-Z]+[a-zA-Z0-9'\{\}]*/);
        if (variableMatch) {
            tokens.push({
                type: 'variable',
                value: variableMatch[0]
            });
            i += variableMatch[0].length;
            continue;
        }

        // Handle anything else as a variable
        tokens.push({
            type: 'variable',
            value: char
        });
        i++;
    }
    return tokens;
}

export function textToLatex(text) {
    try {
        return convertBlocksToLatex(tokenize(text));
    } catch (error) {
        console.error("Error during conversion:", error);
        // throw error; // Re-throw the error to be caught in the updatePreview function
    }
}