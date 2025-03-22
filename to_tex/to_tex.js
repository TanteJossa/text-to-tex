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
                case '+': return '+';
                case '-': return '-';
                case '*': return '\\cdot';
                case '/': return '\\dfrac{';
                default: return block.value; // For equallike operators
            }
        } else if (block.type === 'variable') {
            return isUnit ? `\\text{ ${block.value.replace(/({|})/g, '\\$1')}}` : block.value.replace(/({|})/g, '\\$1');
        } else if (block.type === 'text') {
            return `\\text{${block.value}}`;
        } else if (block.type === 'braces') {
            return `{${convertBlocksToLatex(block.blocks, isUnit)}}`;
        } else if (block.type === 'brackets') {
            const unitBlocks = convertBlocksToLatex(block.blocks, true);
            return `\\text{ ${unitBlocks}}`;
        } else if (block.type === 'function') {
            if (block.sub_eq) {
                const sub_eq = block.sub_eq.map(eq => convertBlocksToLatex(eq, isUnit));
                console.log(block.sub_eq, sub_eq)
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


// Example usage:
const blocksExample = [
    { type: 'variable', value: 'F' },
    { type: 'operator', value: '_' },
    { type: 'variable', value: 'z' },
    { type: 'whitespace', value: ' ' },
    { type: 'operator', value: '=' },
    { type: 'whitespace', value: ' ' },
    { type: 'number', value: '123' },
    { type: 'whitespace', value: ' ' },
    { type: 'variable', value: 'm' },
    { type: 'operator', value: '/' },
    { type: 'variable', value: 's' },
    { type: 'whitespace', value: ' ' },
    { type: 'operator', value: '+' },
    { type: 'whitespace', value: ' ' },
    { type: 'number', value: '456' },
    { type: 'whitespace', value: ' ' },
    { type: 'variable', value: 'm' },
    { type: 'operator', value: '/' },
    { type: 'braces', blocks: [
        { type: 'variable', value: 's' },
        { type: 'operator', value: '^' },
        { type: 'number', value: '2' }
    ]},
    { type: 'whitespace', value: ' ' },
    { type: 'operator', value: '-' },
    { type: 'whitespace', value: ' ' },
    { type: 'number', value: '789' },
    { type: 'whitespace', value: ' ' },
    { type: 'variable', value: 'm' },
    { type: 'operator', value: '/' },
    { type: 'variable', value: 's' }
];

// Prompt for input
function runPrompt() {
    const inputPrompt = require('prompt-sync')(); // Initialize the prompt function
    const tokenize = require('../tokenize/tokenize.js')

    while (true) {
        const input = inputPrompt("Enter LaTeX expression (or type 'exit' to quit): ");
        if (input.toLowerCase() === 'exit') break;
        const tokens = tokenize.tokenize(input);
        console.log(JSON.stringify(tokens, null, 4));
        console.log(convertBlocksToLatex(tokens));
    }
}
runPrompt();

console.log(convertBlocksToLatex(blocksExample));