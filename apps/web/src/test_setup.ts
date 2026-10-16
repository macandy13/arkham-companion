/**
 * Vitest setup for the web app's jsdom tests (registered in the root `vitest.config.ts`).
 * jsdom has no `HTMLDialogElement.showModal`/`close`; these stand-ins toggle the `open`
 * attribute, which is all the component tests look at, so components can call the real
 * dialog API without test-only branches.
 */
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
}
