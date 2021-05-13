export class RollPF extends Roll {
  static get name() {
    return "Roll";
  }

  static safeRoll(formula, data = {}, context, options = { suppressError: false }) {
    let roll;
    try {
      roll = this.create(formula, data).evaluate();
    } catch (err) {
      roll = this.create("0", data).evaluate();
      roll.err = err;
    }
    if (roll.warning) roll.err = Error("This formula had a value replaced with null.");
    if (roll.err) {
      if (context && !options.suppressError) console.error(context, roll.err);
      else if (CONFIG.debug.roll) console.error(roll.err);
    }
    return roll;
  }

  static safeTotal(formula, data) {
    return isNaN(+formula) ? RollPF.safeRoll(formula, data).total : +formula;
  }

  _identifyTerms(formula, { step = 0 } = {}) {
    if (typeof formula !== "string") throw new Error("The formula provided to a Roll instance must be a string");
    formula = this.constructor._preProcessDiceFormula(formula, this.data);
    var warned;

    // Step 1 - Update the Roll formula using provided data
    [formula, warned] = this.constructor.replaceFormulaData(formula, this.data, { missing: "0", warn: false });
    if (warned) this.warning = true;

    // Step 2 - identify separate parenthetical terms
    let terms = this._splitParentheticalTerms(formula);

    // Step 3 - expand pooled terms
    terms = this._splitPooledTerms(terms);

    // Step 4 - expand remaining arithmetic terms
    terms = this._splitDiceTerms(terms, step);

    // Step 4.5 - Strip non-functional term flavor text
    terms = terms.map((t) => {
      if (typeof t !== "string") return t;
      const stripped = t.replace(/\s*\[.*\]\s*/, ""),
        num = /\D/.test(stripped) ? NaN : parseFloat(stripped);
      if (isNaN(num)) return stripped;
      else return num;
    });

    // Step 5 - clean and de-dupe terms
    terms = this.constructor.cleanTerms(terms);
    return terms;
  }

  _splitParentheticalTerms(formula) {
    // Augment parentheses with semicolons and split into terms
    const split = formula.replace(/\(/g, ";(;").replace(/\)/g, ";);");

    // Match outer-parenthetical groups
    let nOpen = 0;
    const terms = split.split(";").reduce((arr, t, i, terms) => {
      if (t === "") return arr;

      // Identify whether the left-parentheses opens a math function
      let mathFn = false;
      if (t === "(") {
        const fn = terms[i - 1].match(/(?:\s)?([A-z0-9]+)$/);
        mathFn = fn && !!RollPF.MATH_PROXY[fn[1]];
      }

      // Combine terms using open parentheses and math expressions
      if (nOpen > 0 || mathFn) arr[arr.length - 1] += t;
      else arr.push(t);

      // Increment the count
      if (t === "(") nOpen++;
      else if (t === ")" && nOpen > 0) nOpen--;
      return arr;
    }, []);

    // Close any un-closed parentheses
    for (let i = 0; i < nOpen; i++) terms[terms.length - 1] += ")";

    // Substitute parenthetical dice rolls groups to inner Roll objects
    return terms.reduce((terms, term) => {
      const prior = terms.length ? terms[terms.length - 1] : null;
      if (term[0] === "(") {
        // Handle inner Roll parenthetical groups
        if (/[dD]/.test(term)) {
          terms.push(RollPF.fromTerm(term, this.data));
          return terms;
        }

        // Evaluate arithmetic-only parenthetical groups
        term = this._safeEval(term);
        /* Changed functionality */
        /* Allow null/string/true/false as it used to be and crash on undefined */
        if (typeof term !== "undefined" && typeof term !== "number") term += "";
        else term = Number.isInteger(term) ? term : term.toFixed(2);
        /* End changed functionality */

        // Continue wrapping math functions
        const priorMath = prior && prior.split(" ").pop() in Math;
        if (priorMath) term = `(${term})`;
      }

      // Append terms to to non-Rolls
      if (prior !== null && !(prior instanceof Roll)) terms[terms.length - 1] += term;
      else terms.push(term);
      return terms;
    }, []);
  }

  static replaceFormulaData(formula, data, { missing, warn = false }) {
    let dataRgx = new RegExp(/@([a-z.0-9_-]+)/gi);
    var warned = false;
    return [
      formula.replace(dataRgx, (match, term) => {
        let value = getProperty(data, term);
        if (value === undefined) {
          if (warn) ui.notifications.warn(game.i18n.format("DICE.WarnMissingData", { match }));
          warned = true;
          return missing !== undefined ? String(missing) : match;
        }
        return String(value).trim();
      }),
      warned,
    ];
  }

  static _preProcessDiceFormula(formula, data = {}) {
    // Replace parentheses with semicolons to use for splitting
    let toSplit = formula
      .replace(/([A-z]+)?\(/g, (match, prefix) => {
        return prefix in game.pf1.rollPreProcess || prefix in Math ? `;${prefix};(;` : ";(;";
      })
      .replace(/\)/g, ";);");
    let terms = toSplit.split(";");

    // Match parenthetical groups
    let nOpen = 0,
      nOpenPreProcess = [];
    terms = terms.reduce((arr, t) => {
      // Handle cases where the prior term is a math function
      const beginPreProcessFn = t[0] === "(" && arr[arr.length - 1] in game.pf1.rollPreProcess;
      if (beginPreProcessFn) nOpenPreProcess.push([arr.length - 1, nOpen]);
      const beginMathFn = t[0] === "(" && arr[arr.length - 1] in Math;
      if (beginMathFn && nOpenPreProcess.length > 0) nOpenPreProcess.push([arr.length - 1, nOpen]);

      // Add terms to the array
      arr.push(t);

      // Increment the number of open parentheses
      if (t === "(") nOpen++;
      if (nOpen > 0 && t === ")") {
        nOpen--;
        for (let a = 0; a < nOpenPreProcess.length; a++) {
          let obj = nOpenPreProcess[a];
          // End pre process function
          if (obj[1] === nOpen) {
            const sliceLen = arr.length - obj[0];
            let fnData = arr.splice(obj[0], sliceLen),
              fn = fnData[0];
            let fnParams = fnData
              .slice(2, -1)
              .reduce((cur, s) => {
                cur.push(...s.split(/\s*,\s*/));
                return cur;
              }, [])
              .map((o) => {
                // Return raw string
                if ((o.startsWith('"') && o.endsWith('"')) || (o.startsWith("'") && o.endsWith("'"))) {
                  return o.slice(1, -1);
                }
                // Return data string
                else if (o.match(/^@([a-zA-Z0-9-.]+)$/)) {
                  const value = getProperty(data, RegExp.$1);
                  if (typeof value === "string") return value;
                }
                // Return roll result
                return RollPF.safeRoll(o, data).total;
              })
              .filter((o) => o !== "" && o != null);
            if (fn in Math) {
              arr.push(Math[fn](...fnParams).toString());
            } else {
              arr.push(game.pf1.rollPreProcess[fn](...fnParams).toString());
            }

            nOpenPreProcess.splice(a, 1);
            a--;
          }
        }
      }
      return arr;
    }, []);

    return terms.join("");
  }
}
