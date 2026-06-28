const fs = require('fs');

/**
 * Parses a single CSV line with support for quotes and escaped quotes, matching src/csv_parser.c
 * @param {string} line 
 * @returns {string[]}
 */
function parseCSVLine(line) {
    const cols = [];
    const len = line.length;
    let i = 0;

    while (i < len) {
        // Skip leading spaces before checking for quotes
        while (i < len && /\s/.test(line[i]) && line[i] !== ',') {
            i++;
        }

        if (i < len && line[i] === '"') {
            // Quoted field
            i++; // skip opening quote
            let start = i;
            let val = "";
            while (i < len) {
                if (line[i] === '"') {
                    if (i + 1 < len && line[i + 1] === '"') {
                        val += '"';
                        i += 2;
                    } else {
                        break; // closing quote
                    }
                } else {
                    val += line[i];
                    i++;
                }
            }
            if (i < len && line[i] === '"') {
                i++; // skip closing quote
            }
            // Consume up to the next comma
            while (i < len && line[i] !== ',') {
                i++;
            }
            cols.push(val);
        } else {
            // Unquoted field
            let start = i;
            while (i < len && line[i] !== ',') {
                i++;
            }
            let val = line.substring(start, i).trim();
            cols.push(val);
        }

        if (i < len && line[i] === ',') {
            i++; // skip comma
        }
    }

    // Check if line ended with a comma (signaling an empty last field)
    if (len > 0 && line[len - 1] === ',') {
        cols.push("");
    }

    return cols;
}

/**
 * Checks if a string represents a valid numeric value, matching C's strtod behavior
 * @param {string} s 
 * @returns {boolean}
 */
function isNumericString(s) {
    if (!s || s.trim() === "") return false;
    const num = Number(s);
    return !isNaN(num) && isFinite(num);
}

/**
 * Parses a CSV file and loads it into a DataFrame object
 * @param {string} filepath 
 * @returns {object|null}
 */
function parseCSV(filepath) {
    try {
        if (!fs.existsSync(filepath)) {
            console.error(`File does not exist: ${filepath}`);
            return null;
        }

        const content = fs.readFileSync(filepath, 'utf8');
        // Handle line endings cleanly (\r\n or \n)
        const lines = content.split(/\r?\n/);
        
        if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === "")) {
            return null;
        }

        // Parse header
        const headerLine = lines[0];
        const headers = parseCSVLine(headerLine);
        if (headers.length === 0) {
            return null;
        }

        const colCount = headers.length;
        const data = [];

        // Parse rows
        for (let r = 1; r < lines.length; r++) {
            const line = lines[r];
            if (line.trim() === "") {
                continue; // skip empty lines
            }

            const parsedCols = parseCSVLine(line);
            const alignedRow = [];
            for (let c = 0; c < colCount; c++) {
                if (c < parsedCols.length) {
                    alignedRow.push(parsedCols[c]);
                } else {
                    alignedRow.push(""); // Missing column padding
                }
            }
            data.push(alignedRow);
        }

        // Determine column types (is_numeric)
        const isNumeric = Array(colCount).fill(true);
        for (let c = 0; c < colCount; c++) {
            let hasAnyValue = false;
            for (let r = 0; r < data.length; r++) {
                const val = data[r][c];
                if (val !== undefined && val !== "") {
                    hasAnyValue = true;
                    if (!isNumericString(val)) {
                        isNumeric[c] = false;
                        break;
                    }
                }
            }
            if (!hasAnyValue) {
                isNumeric[c] = false;
            }
        }

        return {
            headers,
            data,
            rowCount: data.length,
            colCount,
            isNumeric
        };
    } catch (err) {
        console.error("Error parsing CSV:", err);
        return null;
    }
}

/**
 * Calculates descriptive stats for a column in DataFrame, matching src/analytics.c
 * @param {object} df 
 * @param {string} colName 
 * @returns {object}
 */
function calculateColumnStats(df, colName) {
    const stats = {
        colName,
        isValid: false,
        count: 0,
        missingCount: 0,
        sum: 0,
        mean: 0,
        median: 0,
        min: null,
        max: null,
        variance: 0,
        stddev: 0
    };

    if (!df || !colName) {
        return stats;
    }

    const colIdx = df.headers.indexOf(colName);
    if (colIdx === -1) {
        return stats;
    }

    // Check if numeric column
    if (!df.isNumeric[colIdx]) {
        // String column analysis: count valid and missing
        for (let r = 0; r < df.rowCount; r++) {
            const val = df.data[r][colIdx];
            if (val === undefined || val === "") {
                stats.missingCount++;
            } else {
                stats.count++;
            }
        }
        return stats;
    }

    const values = [];
    let sum = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let r = 0; r < df.rowCount; r++) {
        const valStr = df.data[r][colIdx];
        if (valStr === undefined || valStr === "") {
            stats.missingCount++;
            continue;
        }

        if (isNumericString(valStr)) {
            const val = parseFloat(valStr);
            sum += val;
            if (val < minVal) minVal = val;
            if (val > maxVal) maxVal = val;
            values.push(val);
        } else {
            stats.missingCount++;
        }
    }

    if (values.length === 0) {
        return stats;
    }

    stats.isValid = true;
    stats.count = values.length;
    stats.sum = sum;
    stats.mean = sum / values.length;
    stats.min = minVal;
    stats.max = maxVal;

    // Variance & Stddev
    let varianceSum = 0;
    for (let i = 0; i < values.length; i++) {
        varianceSum += Math.pow(values[i] - stats.mean, 2);
    }
    
    // Sample variance (divided by N - 1)
    if (values.length > 1) {
        stats.variance = varianceSum / (values.length - 1);
    } else {
        stats.variance = 0;
    }
    stats.stddev = Math.sqrt(stats.variance);

    // Median (sort values ascending)
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    if (values.length % 2 === 1) {
        stats.median = values[mid];
    } else {
        stats.median = (values[mid - 1] + values[mid]) / 2;
    }

    return stats;
}

/**
 * Filter DataFrame records based on operator comparison, matching C behavior
 * @param {object} df 
 * @param {string} colName 
 * @param {string} op 
 * @param {string} valStr 
 * @returns {Array|null}
 */
function filterDataFrame(df, colName, op, valStr) {
    if (!df || !colName || !op || valStr === undefined) return null;

    const colIdx = df.headers.indexOf(colName);
    if (colIdx === -1) {
        throw new Error(`Column '${colName}' not found`);
    }

    const isNumOp = (op === ">" || op === "<");
    const colIsNumeric = df.isNumeric[colIdx];

    if (isNumOp && !colIsNumeric) {
        throw new Error(`Numeric comparison '${op}' cannot be run on string column '${colName}'`);
    }

    let queryDouble = 0;
    if (colIsNumeric && (isNumOp || op === "=")) {
        if (!isNumericString(valStr)) {
            throw new Error(`Invalid numeric value '${valStr}' in filter query`);
        }
        queryDouble = parseFloat(valStr);
    }

    const filteredRows = [];

    for (let r = 0; r < df.rowCount; r++) {
        const val = df.data[r][colIdx];
        let match = false;

        if (op === ">") {
            if (val !== "") {
                const cellVal = parseFloat(val);
                if (cellVal > queryDouble) match = true;
            }
        } else if (op === "<") {
            if (val !== "") {
                const cellVal = parseFloat(val);
                if (cellVal < queryDouble) match = true;
            }
        } else if (op === "=") {
            if (colIsNumeric) {
                if (val !== "") {
                    const cellVal = parseFloat(val);
                    if (cellVal === queryDouble) match = true;
                }
            } else {
                // String exact case-insensitive match
                if (val.toLowerCase() === valStr.toLowerCase()) match = true;
            }
        } else if (op.toLowerCase() === "like") {
            // Substring case-insensitive match
            if (val.toLowerCase().includes(valStr.toLowerCase())) match = true;
        }

        if (match) {
            // Build key-value map for ease of use in JSON response
            const rowObj = {};
            for (let c = 0; c < df.colCount; c++) {
                rowObj[df.headers[c]] = df.data[r][c];
            }
            filteredRows.push(rowObj);
        }
    }

    return filteredRows;
}

module.exports = {
    parseCSV,
    calculateColumnStats,
    filterDataFrame
};
