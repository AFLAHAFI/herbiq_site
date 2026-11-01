import React from 'react';
export class ErrorBoundary extends React.Component<React.PropsWithChildren, {failed: boolean}> {
  declare props: React.PropsWithChildren;
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? <div role="alert" className="p-10 text-center space-y-4"><h2>Unable to display this page</h2><p>Please reload and try again. Other pages are available from the menu.</p><button className="underline" onClick={() => window.location.reload()}>Reload page</button></div> : this.props.children; }
}
