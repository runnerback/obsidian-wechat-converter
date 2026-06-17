import generatedSkills from './generated-skills.js';

/**
 * @typedef {Record<string, unknown>} JsonObject
 * @typedef {{ id: string, label?: string, description?: string, version?: string, order?: number }} AiLayoutSkillManifest
 * @typedef {{ type: string, fields: string[] }} AiLayoutBlockDefinition
 * @typedef {{ id: string, label: string, description?: string, recommendedFor?: string[], tokens?: Record<string, string> }} AiLayoutColorPalette
 * @typedef {{ version?: string, defaultColorPalette?: string, colorPalettes?: AiLayoutColorPalette[] }} AiLayoutColorPaletteCatalog
 * @typedef {{ blocks?: AiLayoutBlockDefinition[], outputFields?: string[] }} AiLayoutBlockCatalog
 * @typedef {{ typography?: JsonObject, image?: JsonObject, profiles?: Record<string, JsonObject>, sectionLabels?: Record<string, string> }} AiLayoutStylePrimitives
 * @typedef {{ version?: string, colorPalettes?: AiLayoutColorPaletteCatalog, blockCatalog?: AiLayoutBlockCatalog, wechatSafeStylePrimitives?: AiLayoutStylePrimitives, schema?: JsonObject, template?: JsonObject }} AiLayoutSharedResources
 * @typedef {{ id: string, manifest: AiLayoutSkillManifest, prompt: string, blocks: unknown, fallback: unknown, skillDoc?: string, examples?: Array<{ name: string, value: unknown }> }} AiLayoutSkill
 * @typedef {{ root: string, shared: AiLayoutSharedResources, skills: AiLayoutSkill[] }} AiLayoutSkillRegistry
 */

/** @type {{ shared: AiLayoutSharedResources, skills: AiLayoutSkill[] }} */
const generatedRegistry = generatedSkills;

/** @type {AiLayoutSkillRegistry | null} */
let cachedRegistry = null;

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  const parsed = /** @type {unknown} */ (JSON.parse(JSON.stringify(value)));
  return /** @type {T} */ (parsed);
}

/** @returns {AiLayoutSkillRegistry} */
export function loadAiLayoutSkillRegistry() {
  if (cachedRegistry) return cachedRegistry;
  cachedRegistry = {
    root: 'embedded://ai-layout-skills',
    shared: clone(generatedRegistry.shared),
    skills: clone(generatedRegistry.skills),
  };
  return cachedRegistry;
}

/**
 * @param {string} id
 * @returns {AiLayoutSkill | null}
 */
export function getAiLayoutSkillById(id) {
  const registry = loadAiLayoutSkillRegistry();
  return registry.skills.find((skill) => skill.id === id) || null;
}

/** @returns {AiLayoutSkill[]} */
export function getAiLayoutSkillList() {
  return loadAiLayoutSkillRegistry().skills.slice();
}

/** @returns {AiLayoutSharedResources} */
export function getAiLayoutSharedResources() {
  return loadAiLayoutSkillRegistry().shared;
}
