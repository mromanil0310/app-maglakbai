import { describe, it, expect } from 'vitest';
import { VALIDATION_QUESTIONS } from '../validationQuestions';
import { ALL_SKILLS } from '../skills';

// Guards the "Prove you know it" question bank: every authored skill must have a
// complete, well-formed 10-question set with a source citation, keyed to a real
// skill id. Keeps quality consistent as paths are added over time.

const skillIds = new Set(ALL_SKILLS.map((s) => s.id));

describe('VALIDATION_QUESTIONS bank', () => {
  for (const [skillId, questions] of Object.entries(VALIDATION_QUESTIONS)) {
    describe(skillId, () => {
      it('is keyed to a real skill id', () => {
        expect(skillIds.has(skillId)).toBe(true);
      });

      it('has exactly 10 questions', () => {
        expect(questions).toHaveLength(10);
      });

      questions.forEach((q, i) => {
        it(`question ${i + 1} is well-formed (4 choices, valid answer, prompt, explanation, source)`, () => {
          expect(q.prompt.trim().length).toBeGreaterThan(0);
          expect(q.choices).toHaveLength(4);
          q.choices.forEach((c) => expect(c.trim().length).toBeGreaterThan(0));
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThanOrEqual(3);
          expect(q.explanation.trim().length).toBeGreaterThan(0);
          expect(q.source && q.source.trim().length).toBeTruthy();
        });
      });
    });
  }

  it('merges into ALL_SKILLS (sql-foundations exposes its 10 bank questions)', () => {
    const sql = ALL_SKILLS.find((s) => s.id === 'sql-foundations');
    expect(sql?.validationQuestions).toHaveLength(10);
  });
});
