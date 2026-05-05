import { validateReadOnlySql } from './exception-check-script-validator';

describe('validateReadOnlySql', () => {
  const ok = (sql: string) => expect(validateReadOnlySql(sql)).toEqual({ valid: true });
  const bad = (sql: string, reasonMatch?: RegExp) => {
    const r = validateReadOnlySql(sql);
    expect(r.valid).toBe(false);
    if (!r.valid && reasonMatch) {
      expect(r.reason).toMatch(reasonMatch);
    }
  };

  describe('accepts valid SELECT queries', () => {
    it('plain SELECT', () => ok('SELECT 1'));
    it('SELECT with schema-qualified table', () => ok('SELECT * FROM "VoucherTransaction"'));
    it('WITH … SELECT (CTE)', () =>
      ok('WITH x AS (SELECT 1) SELECT * FROM x'));
    it('lower-case select', () => ok('select * from "COAMaster"'));
    it('trailing semicolon is allowed', () => ok('SELECT 1;'));
    it('leading/trailing whitespace', () =>
      ok('   \n  SELECT * FROM "COAMaster"  \n  '));
    it('block and line comments stripped', () =>
      ok('/* header comment */\n-- line comment\nSELECT 1'));
    it('nested block comments stripped', () =>
      ok('/* outer /* inner */ still outer */ SELECT 1'));
  });

  describe('rejects non-SELECT start', () => {
    it('empty string', () => bad('', /must be a SELECT/i));
    it('only whitespace', () => bad('   \n\t  ', /must be a SELECT/i));
    it('UPDATE at start', () =>
      bad('UPDATE "VoucherTransaction" SET "Status"=\'D\'', /SELECT/i));
    it('starts with number', () => bad('1', /must be a SELECT/i));
  });

  describe('rejects forbidden keywords anywhere', () => {
    it('DELETE inside body', () =>
      bad('SELECT * FROM x WHERE id IN (DELETE FROM y)', /DELETE/i));
    it('INSERT inside CTE', () =>
      bad('WITH q AS (INSERT INTO x VALUES (1) RETURNING *) SELECT * FROM q', /INSERT/i));
    it('DROP', () => bad('SELECT 1; DROP TABLE x', /DROP|one statement/i));
    it('ALTER', () => bad('SELECT 1 /* */ ; ALTER TABLE x ADD col int', /one statement|ALTER/i));
    it('TRUNCATE', () => bad('SELECT 1 \n TRUNCATE TABLE x', /TRUNCATE/i));
    it('UPDATE inside WITH', () =>
      bad('WITH w AS (UPDATE x SET a=1 RETURNING *) SELECT * FROM w', /UPDATE/i));
    it('GRANT', () => bad('GRANT SELECT ON x TO y', /SELECT/i));
    it('CREATE', () => bad('CREATE TABLE x (id int); SELECT 1', /one statement|CREATE/i));
    it('CALL', () => bad('SELECT do_thing(); CALL proc()', /one statement|CALL/i));
    it('SET session var', () => bad('SET search_path = x; SELECT 1', /one statement|SET/i));
  });

  describe('rejects write-forms of SELECT', () => {
    it('SELECT INTO new_table', () =>
      bad('SELECT * INTO newtable FROM "COAMaster"', /INTO/i));
    it('SELECT … INTO — case-insensitive', () =>
      bad('select x into tmp from y', /INTO/i));
  });

  describe('trailing semicolon handling', () => {
    it('single trailing semicolon ok', () => ok('SELECT 1;'));
    it('single trailing semicolon with trailing whitespace ok', () =>
      ok('SELECT 1;   \n\t'));
    it('semicolon in middle rejected', () =>
      bad('SELECT 1; SELECT 2;', /one statement/i));
    it('string literal containing ; is fine', () =>
      ok(`SELECT ';' AS sep`));
  });

  describe('string literals with keywords are fine', () => {
    it('UPDATE inside quoted string', () =>
      ok(`SELECT 'we will not UPDATE anything' AS msg`));
    it('DELETE inside quoted string', () =>
      ok(`SELECT 'DELETE from dict' AS label FROM "COAMaster"`));
  });

  describe('comment-hidden bad keywords are stripped', () => {
    it('DELETE hidden in line comment is allowed (it IS just a comment)', () =>
      ok('SELECT 1 -- DELETE FROM x'));
    it('UPDATE hidden in block comment is allowed', () =>
      ok('SELECT 1 /* UPDATE hidden */ FROM "COAMaster"'));
  });
});
