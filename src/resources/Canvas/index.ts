import { createCanvas, registerFont, type CanvasRenderingContext2D } from 'canvas';
import path from 'path';

const canvasWidth = 402;
const canvasHeight = 100;

const backgroundColor = '#f5f5f6';
const gridColor = '#e5e6e7';

const textFont_large = '22px Poppins';
const textFont_medium = '21px Poppins';
const textFillStyle = '#000';
const textStrokeStyle = '#666';

interface IRenderHelper {
    vec: { x: number; y: number };
    vect: { x: number; y: number };
    forward: (dist: number) => number;
    posAt: (coef: number) => { x: number; y: number };
    tangent: (pos: number) => void;
}

registerFont(path.join(__dirname, '..', 'Canvas', 'Poppins-SemiBold.ttf'), { family: 'Poppins' });

// eslint-disable-next-line max-lines-per-function
const renderHelper = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
) => {
    let tx1;
    let ty1;
    let tx2;
    let ty2;
    let tx3;
    let ty3;
    let a;
    let b;
    let c;
    let u;
    const vec = { x: 0, y: 0 };
    const vec1 = { x: 0, y: 0 };
    const vect = { x: 0, y: 0 };
    let quad = false;
    let currentPos = 0;
    let currentDist = 0;
    if (x4 === undefined || x4 === null) {
        quad = true;
        // eslint-disable-next-line no-param-reassign
        x4 = x3;
        // eslint-disable-next-line no-param-reassign
        y4 = y3;
    }
    const estLen = Math.sqrt((x4 - x1) * (x4 - x1) + (y4 - y1) * (y4 - y1));
    const onePix = 1 / estLen;

    const posAtC = (coef: number) => {
        tx1 = x1;
        ty1 = y1;
        tx2 = x2;
        ty2 = y2;
        tx3 = x3;
        ty3 = y3;
        tx1 += (tx2 - tx1) * coef;
        ty1 += (ty2 - ty1) * coef;
        tx2 += (tx3 - tx2) * coef;
        ty2 += (ty3 - ty2) * coef;
        tx3 += (x4 - tx3) * coef;
        ty3 += (y4 - ty3) * coef;
        tx1 += (tx2 - tx1) * coef;
        ty1 += (ty2 - ty1) * coef;
        tx2 += (tx3 - tx2) * coef;
        ty2 += (ty3 - ty2) * coef;
        vec.x = tx1 + (tx2 - tx1) * coef;
        vec.y = ty1 + (ty2 - ty1) * coef;
        return vec;
    };
    const posAtQ = (coef: number) => {
        tx1 = x1;
        ty1 = y1;
        tx2 = x2;
        ty2 = y2;
        tx1 += (tx2 - tx1) * coef;
        ty1 += (ty2 - ty1) * coef;
        tx2 += (x3 - tx2) * coef;
        ty2 += (y3 - ty2) * coef;
        vec.x = tx1 + (tx2 - tx1) * coef;
        vec.y = ty1 + (ty2 - ty1) * coef;
        return vec;
    };
    const forward = (dist: number) => {
        let step;
        // eslint-disable-next-line no-use-before-define
        helper.posAt(currentPos);

        while (currentDist < dist) {
            vec1.x = vec.x;
            vec1.y = vec.y;
            currentPos += onePix;
            // eslint-disable-next-line no-use-before-define
            helper.posAt(currentPos);
            step = Math.sqrt(
                (vec.x - vec1.x) * (vec.x - vec1.x) + (vec.y - vec1.y) * (vec.y - vec1.y)
            );
            currentDist += step;
        }
        currentPos -= ((currentDist - dist) / step!) * onePix;
        currentDist -= step!;
        // eslint-disable-next-line no-use-before-define
        helper.posAt(currentPos);
        currentDist += Math.sqrt(
            (vec.x - vec1.x) * (vec.x - vec1.x) + (vec.y - vec1.y) * (vec.y - vec1.y)
        );
        return currentPos;
    };

    const tangentQ = (pos: number) => {
        a = (1 - pos) * 2;
        b = pos * 2;
        vect.x = a * (x2 - x1) + b * (x3 - x2);
        vect.y = a * (y2 - y1) + b * (y3 - y2);
        u = Math.sqrt(vect.x * vect.x + vect.y * vect.y);
        vect.x /= u;
        vect.y /= u;
    };
    const tangentC = (pos: number) => {
        a = 1 - pos;
        b = 6 * a * pos;
        a *= 3 * a;
        c = 3 * pos * pos;
        vect.x = -x1 * a + x2 * (a - b) + x3 * (b - c) + x4 * c;
        vect.y = -y1 * a + y2 * (a - b) + y3 * (b - c) + y4 * c;
        u = Math.sqrt(vect.x * vect.x + vect.y * vect.y);
        vect.x /= u;
        vect.y /= u;
    };

    const helper: IRenderHelper = {
        vec,
        vect,
        forward,
        posAt: quad ? posAtQ : posAtC,
        tangent: quad ? tangentQ : tangentC,
    };

    return helper;
};

const renderText = (
    context: CanvasRenderingContext2D,
    text: string,
    offset: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number
) => {
    context.save();
    context.textAlign = 'center';
    const widths = [];
    for (let i = 0; i < text.length; i++) {
        widths[widths.length] = context.measureText(text[i]).width;
    }
    const ch = renderHelper(x1, y1, x2, y2, x3, y3, x4, y4);
    let pos = offset;
    let cpos = 0;

    for (let i = 0; i < text.length; i++) {
        pos += widths[i] / 2;
        cpos = ch.forward(pos);
        ch.tangent(cpos);
        context.setTransform(ch.vect.x, ch.vect.y, -ch.vect.y, ch.vect.x, ch.vec.x, ch.vec.y);
        context.fillText(text[i], 0, 0);

        pos += widths[i] / 2;
    }
    context.restore();
};

const drawText = (context: CanvasRenderingContext2D, textToTypeArray: string[]) => {
    const wordCount = textToTypeArray.length;

    context.font = wordCount < 5 ? textFont_large : textFont_medium;
    context.fillStyle = textFillStyle;
    context.strokeStyle = textStrokeStyle;
    context.textAlign = 'left';
    context.textBaseline = 'middle';

    // Define text groups based on word count
    let textGroups: string[] = [];

    if (wordCount === 2) {
        // 2 words: 2 parts
        textGroups = [
            `${textToTypeArray[0]}`,
            `${textToTypeArray[1]}`,
        ];
    } else if (wordCount === 3) {
        // 3 words: 1 part
        textGroups = [`${textToTypeArray[0]} ${textToTypeArray[1]} ${textToTypeArray[2]}`];
    } else if (wordCount === 4) {
        // 4 words: 2 words per part, 2 parts
        textGroups = [
            `${textToTypeArray[0]} ${textToTypeArray[1]}`,
            `${textToTypeArray[2]} ${textToTypeArray[3]}`,
        ];
    } else if (wordCount === 5) {
        // 5 words: 2 parts, 2 and 3 words
        textGroups = [
            `${textToTypeArray[0]} ${textToTypeArray[1]}`,
            `${textToTypeArray[2]} ${textToTypeArray[3]} ${textToTypeArray[4]}`,
        ];
    }

    // Render each text group
    textGroups.forEach((textGroup, index) => {
        let yOffset: number = 0;
        let xOffset: number = 0;

        /**
         * Determine x and y axis for each group of words
         */
        if (wordCount === 2) {
            if (index === 0) {
                yOffset = -15;
                xOffset = canvasWidth/2 - context.measureText(textGroup).width -10;
            } else {
                yOffset = 5;
                xOffset = canvasWidth/2 + 10;
            }
        } else if (wordCount === 3) {
            yOffset = 0;
            xOffset = canvasWidth - context.measureText(textGroup).width - 30;
        } else if (wordCount === 4) {
            if (index === 0) {
                yOffset = -25;
                xOffset = 10;
            } else {
                yOffset = 5;
                xOffset = canvasWidth - context.measureText(textGroup).width - 10;
            }
        } else if (wordCount === 5) {
            if (index === 0) {
                yOffset = -30;
                xOffset = 10;
            } else {
                yOffset = 10;
                xOffset = canvasWidth - context.measureText(textGroup).width - 5;
            }
        }

        // Define path coordinates based on position
        let x1: number = 0,
            y1: number = 0,
            x2: number = 0,
            y2: number = 0,
            x3: number = 0,
            y3: number = 0,
            x4: number = 0,
            y4: number = 0;

        if (wordCount === 2) {
            if (index === 0) {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 20 + yOffset;
                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 15 + yOffset;
                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 30 + yOffset;
                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            } else {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 20 + yOffset;
                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 15 + yOffset;
                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 30 + yOffset;
                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            }
        } else if (wordCount === 3) {
            x1 = xOffset;
            y1 = canvasHeight / 2 + 15 + yOffset;
            x2 = canvasWidth / 8 + xOffset;
            y2 = canvasHeight / 2 - 15 + yOffset;
            x3 = canvasWidth / 4 + xOffset;
            y3 = canvasHeight / 2 + 25 + yOffset;
            x4 = canvasWidth / 2 + xOffset;
            y4 = canvasHeight / 2 + 10 + yOffset;
        } else if (wordCount === 4) {
            if (index === 0) {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 15 + yOffset;
                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 15 + yOffset;
                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 25 + yOffset;
                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            } else {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 15 + yOffset;
                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 15 + yOffset;
                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 25 + yOffset;
                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            }
        } else if (wordCount === 5) {
            if (index === 0) {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 15 + yOffset;
                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 15 + yOffset;
                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 25 + yOffset;
                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            } else {
                x1 = xOffset;
                y1 = canvasHeight / 2 + 15 + yOffset;

                x2 = canvasWidth / 8 + xOffset;
                y2 = canvasHeight / 2 - 5 + yOffset;

                x3 = canvasWidth / 4 + xOffset;
                y3 = canvasHeight / 2 + 25 + yOffset;

                x4 = canvasWidth / 2 + xOffset;
                y4 = canvasHeight / 2 + 10 + yOffset;
            }
        }

        renderText(context, textGroup, 0, x1, y1, x2, y2, x3, y3, x4, y4);
    });
};

const drawBackground = (context: CanvasRenderingContext2D) => {
    const {
        canvas: { width, height },
    } = context;

    /** Draw background */
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, width, height);

    /** Draw grid */
    context.strokeStyle = gridColor;
    context.setLineDash([5, 3]);
    context.beginPath();

    for (let x = 0; x < width; x += width / 4) {
        context.moveTo(x - 0.5, 0);
        context.lineTo(x - 0.5, height);
    }
    for (let y = 0; y < height; y += height / 2) {
        context.moveTo(0, y - 0.5);
        context.lineTo(width, y - 0.5);
    }
    context.stroke();
};

export const createTextToTypeCanvas = (textToType: string) => {
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    drawBackground(context);

    if (textToType) {
        // validate word count
        const textToTypeArray = textToType.split(' ');
        const wordCount = textToTypeArray.length;

        if (wordCount < 2 || wordCount > 5) {
            throw Error('Text must have at least 2 and at most 5 words');
        }

        drawText(context, textToTypeArray);
    }

    return canvas.toDataURL();
};
