/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-require-imports -- Generated runtime registry bridges dynamic skill manifests and bundles. */
const generatedSkills = require('./generated-skills');

let cachedRegistry = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadAiLayoutSkillRegistry() {
  if (cachedRegistry) return cachedRegistry;
  cachedRegistry = {
    root: 'embedded://ai-layout-skills',
    shared: clone(generatedSkills.shared),
    skills: clone(generatedSkills.skills),
  };
  return cachedRegistry;
}

function getAiLayoutSkillById(id) {
  const registry = loadAiLayoutSkillRegistry();
  return registry.skills.find((skill) => skill.id === id) || null;
}

function getAiLayoutSkillList() {
  return loadAiLayoutSkillRegistry().skills.slice();
}

function getAiLayoutSharedResources() {
  return loadAiLayoutSkillRegistry().shared;
}

module.exports = {
  loadAiLayoutSkillRegistry,
  getAiLayoutSkillById,
  getAiLayoutSkillList,
  getAiLayoutSharedResources,
};
