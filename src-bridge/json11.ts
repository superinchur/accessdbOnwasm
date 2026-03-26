/**
 * json11.ts: A TypeScript port of the json11 C++ library.
 * Features:
 *  - C-style comment support (// and /* *\/)
 *  - Lexicographically sorted object keys in dump()
 *  - Identical escaping and parsing logic (including max_depth=200)
 */

export namespace json11 {
  export enum Type {
    NUL,
    NUMBER,
    BOOL,
    STRING,
    ARRAY,
    OBJECT,
  }

  export enum JsonParse {
    STANDARD,
    COMMENTS,
  }

  export class Json {
    private _type: Type;
    private _value: any;

    constructor(val: any = null) {
      if (val === null) {
        this._type = Type.NUL;
        this._value = null;
      } else if (typeof val === 'number') {
        this._type = Type.NUMBER;
        this._value = val;
      } else if (typeof val === 'boolean') {
        this._type = Type.BOOL;
        this._value = val;
      } else if (typeof val === 'string') {
        this._type = Type.STRING;
        this._value = val;
      } else if (Array.isArray(val)) {
        this._type = Type.ARRAY;
        this._value = val;
      } else if (typeof val === 'object') {
        this._type = Type.OBJECT;
        this._value = val;
      } else {
        this._type = Type.NUL;
        this._value = null;
      }
    }

    type(): Type { return this._type; }

    is_null(): boolean { return this._type === Type.NUL; }
    is_number(): boolean { return this._type === Type.NUMBER; }
    is_bool(): boolean { return this._type === Type.BOOL; }
    is_string(): boolean { return this._type === Type.STRING; }
    is_array(): boolean { return this._type === Type.ARRAY; }
    is_object(): boolean { return this._type === Type.OBJECT; }

    number_value(): number { return this._type === Type.NUMBER ? this._value : 0; }
    int_value(): number { return this._type === Type.NUMBER ? Math.floor(this._value) : 0; }
    bool_value(): boolean { return this._type === Type.BOOL ? this._value : false; }
    string_value(): string { return this._type === Type.STRING ? this._value : ""; }
    array_items(): Json[] { return this._type === Type.ARRAY ? this._value : []; }
    object_items(): Record<string, Json> { return this._type === Type.OBJECT ? this._value : {}; }

    /**
     * Mimics C++ operator[]
     */
    get(key: string | number): Json {
      if (typeof key === 'number' && this._type === Type.ARRAY) {
        return this._value[key] || new Json(null);
      }
      if (typeof key === 'string' && this._type === Type.OBJECT) {
        return this._value[key] || new Json(null);
      }
      return new Json(null);
    }

    dump(): string {
      const out: string[] = [];
      this._dump(out);
      return out.join('');
    }

    private _dump(out: string[]): void {
      switch (this._type) {
        case Type.NUL:
          out.push("null");
          break;
        case Type.BOOL:
          out.push(this._value ? "true" : "false");
          break;
        case Type.NUMBER:
          if (isFinite(this._value)) {
            // Match snprintf(buf, sizeof buf, "%.17g", value);
            // JS's toString handles this pretty well, but we can refine if needed.
            out.push(this._value.toString());
          } else {
            out.push("null");
          }
          break;
        case Type.STRING:
          this._dumpString(this._value, out);
          break;
        case Type.ARRAY:
          out.push("[");
          for (let i = 0; i < this._value.length; i++) {
            if (i > 0) out.push(", ");
            this._value[i]._dump(out);
          }
          out.push("]");
          break;
        case Type.OBJECT:
          out.push("{");
          const keys = Object.keys(this._value).sort(); // std::map is sorted
          for (let i = 0; i < keys.length; i++) {
            if (i > 0) out.push(", ");
            this._dumpString(keys[i], out);
            out.push(": ");
            this._value[keys[i]]._dump(out);
          }
          out.push("}");
          break;
      }
    }

    private _dumpString(val: string, out: string[]) {
      out.push('"');
      for (let i = 0; i < val.length; i++) {
        const ch = val[i];
        const code = val.charCodeAt(i);
        if (ch === '\\') out.push("\\\\");
        else if (ch === '"') out.push("\\\"");
        else if (ch === '\b') out.push("\\b");
        else if (ch === '\f') out.push("\\f");
        else if (ch === '\n') out.push("\\n");
        else if (ch === '\r') out.push("\\r");
        else if (ch === '\t') out.push("\\t");
        else if (code <= 0x1f) {
          out.push(`\\u${code.toString(16).padStart(4, '0')}`);
        } else if (ch === '\u2028') {
          out.push("\\u2028");
        } else if (ch === '\u2029') {
          out.push("\\u2029");
        } else {
          out.push(ch);
        }
      }
      out.push('"');
    }

    static parse(str: string, strategy: JsonParse = JsonParse.STANDARD): { value: Json, error: string } {
      const parser = new JsonParser(str, strategy);
      const result = parser.parseJson(0);
      parser.consumeGarbage();
      if (parser.failed) return { value: new Json(null), error: parser.err };
      if (parser.i !== str.length) return { value: new Json(null), error: "unexpected trailing " + parser.esc(str[parser.i]) };
      return { value: result, error: "" };
    }

    static parse_multi(str: string, strategy: JsonParse = JsonParse.STANDARD): { values: Json[], error: string, stop_pos: number } {
      const parser = new JsonParser(str, strategy);
      const json_vec: Json[] = [];
      let stop_pos = 0;
      while (parser.i !== str.length && !parser.failed) {
        json_vec.push(parser.parseJson(0));
        if (parser.failed) break;
        parser.consumeGarbage();
        if (parser.failed) break;
        stop_pos = parser.i;
      }
      return { values: json_vec, error: parser.failed ? parser.err : "", stop_pos };
    }

    has_shape(types: Record<string, Type>): { ok: boolean, error: string } {
      if (!this.is_object()) {
        return { ok: false, error: "expected JSON object, got " + this.dump() };
      }
      const items = this.object_items();
      for (const key in types) {
        if (this.get(key).type() !== types[key]) {
          return { ok: false, error: "bad type for " + key + " in " + this.dump() };
        }
      }
      return { ok: true, error: "" };
    }
  }

  class JsonParser {
    i: number = 0;
    failed: boolean = false;
    err: string = "";
    private max_depth = 200;

    constructor(public str: string, public strategy: JsonParse) {}

    fail(msg: string, retVal: any = null): any {
      if (!this.failed) this.err = msg;
      this.failed = true;
      return retVal;
    }

    consumeWhitespace() {
      while (this.i < this.str.length && (this.str[this.i] === ' ' || this.str[this.i] === '\r' || this.str[this.i] === '\n' || this.str[this.i] === '\t')) {
        this.i++;
      }
    }

    consumeComment(): boolean {
      if (this.str[this.i] === '/') {
        this.i++;
        if (this.i === this.str.length) return this.fail("unexpected end of input after start of comment", false);
        if (this.str[this.i] === '/') { // inline
          this.i++;
          while (this.i < this.str.length && this.str[this.i] !== '\n') this.i++;
          return true;
        } else if (this.str[this.i] === '*') { // multiline
          this.i++;
          if (this.i > this.str.length - 2) return this.fail("unexpected end of input inside multi-line comment", false);
          while (!(this.str[this.i] === '*' && this.str[this.i + 1] === '/')) {
            this.i++;
            if (this.i > this.str.length - 2) return this.fail("unexpected end of input inside multi-line comment", false);
          }
          this.i += 2;
          return true;
        } else {
          return this.fail("malformed comment", false);
        }
      }
      return false;
    }

    consumeGarbage() {
      this.consumeWhitespace();
      if (this.strategy === JsonParse.COMMENTS) {
        let found;
        do {
          found = this.consumeComment();
          if (this.failed) return;
          this.consumeWhitespace();
        } while (found);
      }
    }

    getNextToken(): string {
      this.consumeGarbage();
      if (this.failed) return "";
      if (this.i === this.str.length) return this.fail("unexpected end of input", "");
      return this.str[this.i++];
    }

    esc(c: string): string {
      if (!c) return "(null)";
      const code = c.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7f) return `'${c}' (${code})`;
      return `(${code})`;
    }

    parseString(): string {
      let out = "";
      while (true) {
        if (this.i === this.str.length) return this.fail("unexpected end of input in string", "");
        let ch = this.str[this.i++];
        if (ch === '"') return out;
        if (ch.charCodeAt(0) <= 0x1f) return this.fail("unescaped " + this.esc(ch) + " in string", "");

        if (ch !== '\\') {
          out += ch;
          continue;
        }

        if (this.i === this.str.length) return this.fail("unexpected end of input in string", "");
        ch = this.str[this.i++];
        if (ch === 'u') {
          const esc = this.str.substr(this.i, 4);
          if (esc.length < 4 || !/^[0-9a-fA-F]{4}$/.test(esc)) return this.fail("bad \\u escape: " + esc, "");
          const codepoint = parseInt(esc, 16);
          out += String.fromCharCode(codepoint);
          this.i += 4;
        } else if (ch === 'b') out += '\b';
        else if (ch === 'f') out += '\f';
        else if (ch === 'n') out += '\n';
        else if (ch === 'r') out += '\r';
        else if (ch === 't') out += '\t';
        else if (ch === '"' || ch === '\\' || ch === '/') out += ch;
        else return this.fail("invalid escape character " + this.esc(ch), "");
      }
    }

    parseNumber(): Json {
      const startPos = this.i;
      if (this.str[this.i] === '-') this.i++;
      if (this.str[this.i] === '0') {
        this.i++;
        if (/[0-9]/.test(this.str[this.i])) return this.fail("leading 0s not permitted in numbers");
      } else if (/[1-9]/.test(this.str[this.i])) {
        this.i++;
        while (/[0-9]/.test(this.str[this.i])) this.i++;
      } else {
        return this.fail("invalid " + this.esc(this.str[this.i]) + " in number");
      }

      if (this.str[this.i] === '.') {
        this.i++;
        if (!/[0-9]/.test(this.str[this.i])) return this.fail("at least one digit required in fractional part");
        while (/[0-9]/.test(this.str[this.i])) this.i++;
      }

      if (this.str[this.i] === 'e' || this.str[this.i] === 'E') {
        this.i++;
        if (this.str[this.i] === '+' || this.str[this.i] === '-') this.i++;
        if (!/[0-9]/.test(this.str[this.i])) return this.fail("at least one digit required in exponent");
        while (/[0-9]/.test(this.str[this.i])) this.i++;
      }

      return new Json(parseFloat(this.str.substring(startPos, this.i)));
    }

    expect(expected: string, res: any): Json {
      this.i--;
      if (this.str.substr(this.i, expected.length) === expected) {
        this.i += expected.length;
        return new Json(res);
      }
      return this.fail("parse error: expected " + expected + ", got " + this.str.substr(this.i, expected.length));
    }

    parseJson(depth: number): Json {
      if (depth > this.max_depth) return this.fail("exceeded maximum nesting depth");
      const ch = this.getNextToken();
      if (this.failed) return new Json(null);

      if (ch === '-' || (ch >= '0' && ch <= '9')) {
        this.i--;
        return this.parseNumber();
      }

      if (ch === 't') return this.expect("true", true);
      if (ch === 'f') return this.expect("false", false);
      if (ch === 'n') return this.expect("null", null);
      if (ch === '"') return new Json(this.parseString());

      if (ch === '{') {
        const data: Record<string, Json> = {};
        let next = this.getNextToken();
        if (next === '}') return new Json(data);
        while (true) {
          if (next !== '"') return this.fail("expected '\"' in object, got " + this.esc(next));
          const key = this.parseString();
          if (this.failed) return new Json(null);
          next = this.getNextToken();
          if (next !== ':') return this.fail("expected ':' in object, got " + this.esc(next));
          data[key] = this.parseJson(depth + 1);
          if (this.failed) return new Json(null);
          next = this.getNextToken();
          if (next === '}') break;
          if (next !== ',') return this.fail("expected ',' in object, got " + this.esc(next));
          next = this.getNextToken();
        }
        return new Json(data);
      }

      if (ch === '[') {
        const data: Json[] = [];
        let next = this.getNextToken();
        if (next === ']') return new Json(data);
        while (true) {
          this.i--;
          data.push(this.parseJson(depth + 1));
          if (this.failed) return new Json(null);
          next = this.getNextToken();
          if (next === ']') break;
          if (next !== ',') return this.fail("expected ',' in list, got " + this.esc(next));
          next = this.getNextToken();
        }
        return new Json(data);
      }

      return this.fail("expected value, got " + this.esc(ch));
    }
  }
}
