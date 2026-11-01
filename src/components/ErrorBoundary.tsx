import React from 'react';
import { translate, detectInitialLang } from '../i18n';

export class ErrorBoundary extends React.Component<React.PropsWithChildren, {failed: boolean}> {
  declare props: React.PropsWithChildren;
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    const lang = detectInitialLang();
    return (
      <div role="alert" className="p-10 text-center space-y-4">
        <h2>{translate(lang, 'app.errorTitle')}</h2>
        <p>{translate(lang, 'app.errorBody')}</p>
        <button className="underline" onClick={() => window.location.reload()}>
          {translate(lang, 'app.reloadPage')}
        </button>
      </div>
    );
  }
}
