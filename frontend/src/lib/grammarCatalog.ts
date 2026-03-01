import type { GrammarLevelId, GrammarSkill, GrammarLevelSummary } from '../types';

const A1_SKILLS: GrammarSkill[] = [
  { id: 'a1-to-be', levelId: 'A1', title: 'Verb "to be"', description: 'am, is, are in present tense' },
  { id: 'a1-pronouns', levelId: 'A1', title: 'Personal Pronouns', description: 'I, you, he, she, it, we, they' },
  { id: 'a1-articles', levelId: 'A1', title: 'Articles a/an/the', description: 'When to use a, an, and the' },
  { id: 'a1-present-simple', levelId: 'A1', title: 'Present Simple', description: 'Habits, facts, and routines' },
  { id: 'a1-plurals', levelId: 'A1', title: 'Plural Nouns', description: 'Regular and common irregular plurals' },
  { id: 'a1-this-that', levelId: 'A1', title: 'This/That/These/Those', description: 'Demonstrative pronouns' },
  { id: 'a1-prepositions-place', levelId: 'A1', title: 'Prepositions of Place', description: 'in, on, at, under, next to' },
  { id: 'a1-can', levelId: 'A1', title: 'Can / Can\'t', description: 'Ability and permission' },
];

const A2_SKILLS: GrammarSkill[] = [
  { id: 'a2-past-simple', levelId: 'A2', title: 'Past Simple', description: 'Regular and irregular past tense' },
  { id: 'a2-present-continuous', levelId: 'A2', title: 'Present Continuous', description: 'Actions happening now' },
  { id: 'a2-future-going-to', levelId: 'A2', title: 'Going to (Future)', description: 'Plans and intentions' },
  { id: 'a2-comparatives', levelId: 'A2', title: 'Comparatives', description: 'bigger, more interesting, better' },
  { id: 'a2-superlatives', levelId: 'A2', title: 'Superlatives', description: 'biggest, most interesting, best' },
  { id: 'a2-countable-uncountable', levelId: 'A2', title: 'Countable & Uncountable', description: 'much/many, some/any, a lot of' },
  { id: 'a2-adverbs-frequency', levelId: 'A2', title: 'Adverbs of Frequency', description: 'always, usually, sometimes, never' },
  { id: 'a2-imperatives', levelId: 'A2', title: 'Imperatives', description: 'Commands and instructions' },
];

const B1_SKILLS: GrammarSkill[] = [
  { id: 'b1-present-perfect', levelId: 'B1', title: 'Present Perfect', description: 'Experiences and unfinished time' },
  { id: 'b1-past-continuous', levelId: 'B1', title: 'Past Continuous', description: 'Actions in progress in the past' },
  { id: 'b1-will-future', levelId: 'B1', title: 'Will (Future)', description: 'Predictions and spontaneous decisions' },
  { id: 'b1-first-conditional', levelId: 'B1', title: 'First Conditional', description: 'If + present, will + infinitive' },
  { id: 'b1-modals-obligation', levelId: 'B1', title: 'Must / Have to / Should', description: 'Obligation and advice' },
  { id: 'b1-passive-present', levelId: 'B1', title: 'Passive Voice (Present)', description: 'is/are + past participle' },
  { id: 'b1-relative-clauses', levelId: 'B1', title: 'Relative Clauses', description: 'who, which, that, where' },
  { id: 'b1-gerunds-infinitives', levelId: 'B1', title: 'Gerunds & Infinitives', description: 'enjoy doing vs. want to do' },
];

const B2_SKILLS: GrammarSkill[] = [
  { id: 'b2-present-perfect-cont', levelId: 'B2', title: 'Present Perfect Continuous', description: 'Duration of recent actions' },
  { id: 'b2-past-perfect', levelId: 'B2', title: 'Past Perfect', description: 'Events before another past event' },
  { id: 'b2-second-conditional', levelId: 'B2', title: 'Second Conditional', description: 'Unreal/hypothetical present situations' },
  { id: 'b2-third-conditional', levelId: 'B2', title: 'Third Conditional', description: 'Unreal past situations' },
  { id: 'b2-reported-speech', levelId: 'B2', title: 'Reported Speech', description: 'He said that..., She told me...' },
  { id: 'b2-passive-all', levelId: 'B2', title: 'Passive Voice (All Tenses)', description: 'was built, has been done, will be sent' },
  { id: 'b2-wish-if-only', levelId: 'B2', title: 'Wish / If only', description: 'Expressing regret and desires' },
  { id: 'b2-used-to', levelId: 'B2', title: 'Used to / Would', description: 'Past habits and states' },
];

const C1_SKILLS: GrammarSkill[] = [
  { id: 'c1-mixed-conditionals', levelId: 'C1', title: 'Mixed Conditionals', description: 'Mixing time references in conditionals' },
  { id: 'c1-inversion', levelId: 'C1', title: 'Inversion', description: 'Not only... but also, Rarely do...' },
  { id: 'c1-cleft-sentences', levelId: 'C1', title: 'Cleft Sentences', description: 'It was John who..., What I need is...' },
  { id: 'c1-advanced-passives', levelId: 'C1', title: 'Advanced Passives', description: 'Have something done, causative' },
  { id: 'c1-subjunctive', levelId: 'C1', title: 'Subjunctive Mood', description: 'I suggest he go, If I were...' },
  { id: 'c1-participle-clauses', levelId: 'C1', title: 'Participle Clauses', description: 'Having finished, Not knowing what...' },
  { id: 'c1-noun-clauses', levelId: 'C1', title: 'Noun Clauses', description: 'What he said was..., Whether or not...' },
];

const C2_SKILLS: GrammarSkill[] = [
  { id: 'c2-ellipsis-substitution', levelId: 'C2', title: 'Ellipsis & Substitution', description: 'Omitting repeated words elegantly' },
  { id: 'c2-fronting', levelId: 'C2', title: 'Fronting & Focus', description: 'Moving elements for emphasis' },
  { id: 'c2-discourse-markers', levelId: 'C2', title: 'Discourse Markers', description: 'Nevertheless, furthermore, albeit' },
  { id: 'c2-advanced-modality', levelId: 'C2', title: 'Advanced Modality', description: 'Might have been, could well be' },
  { id: 'c2-nominalization', levelId: 'C2', title: 'Nominalization', description: 'Turning verbs/adj into nouns for formal writing' },
  { id: 'c2-hedging', levelId: 'C2', title: 'Hedging & Vague Language', description: 'It tends to, somewhat, a kind of' },
];

export const GRAMMAR_CATALOG: GrammarLevelSummary[] = [
  { id: 'A1', title: 'Beginner', description: 'Basic sentence structure and everyday expressions', skills: A1_SKILLS },
  { id: 'A2', title: 'Elementary', description: 'Simple past, future, and comparisons', skills: A2_SKILLS },
  { id: 'B1', title: 'Intermediate', description: 'Perfect tenses, conditionals, and passive voice', skills: B1_SKILLS },
  { id: 'B2', title: 'Upper-Intermediate', description: 'Complex tenses, reported speech, and hypotheticals', skills: B2_SKILLS },
  { id: 'C1', title: 'Advanced', description: 'Inversion, cleft sentences, and advanced structures', skills: C1_SKILLS },
  { id: 'C2', title: 'Proficiency', description: 'Native-level nuance, discourse, and formal register', skills: C2_SKILLS },
];

export const GRAMMAR_LEVELS: GrammarLevelId[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_COLORS: Record<GrammarLevelId, { bg: string; border: string; text: string; gradient: string }> = {
  A1: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-400', gradient: 'from-green-500/20 to-green-600/5' },
  A2: { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-400', gradient: 'from-teal-500/20 to-teal-600/5' },
  B1: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', gradient: 'from-blue-500/20 to-blue-600/5' },
  B2: { bg: 'bg-indigo-500', border: 'border-indigo-500', text: 'text-indigo-400', gradient: 'from-indigo-500/20 to-indigo-600/5' },
  C1: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400', gradient: 'from-purple-500/20 to-purple-600/5' },
  C2: { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', gradient: 'from-amber-500/20 to-amber-600/5' },
};
