/**
 * Abstract base class for platform adapters.
 * Every method throws if not overridden — forces each adapter
 * to implement the complete interface.
 */
class PlatformAdapter {
  constructor() {
    if (new.target === PlatformAdapter)
      throw new Error('PlatformAdapter is abstract.');
  }
  getPlatformName()      { throw new Error('Not implemented'); }
  getProblemTitle()       { throw new Error('Not implemented'); }
  getProblemId()          { throw new Error('Not implemented'); }
  getProblemDescription() { throw new Error('Not implemented'); }
  getSubmittedCode()      { throw new Error('Not implemented'); }
  getLanguageExtension()  { throw new Error('Not implemented'); }
  isSubmissionAccepted()  { throw new Error('Not implemented'); }
}
      