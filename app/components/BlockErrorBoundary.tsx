"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback: ReactNode };
type State = { failed: boolean };

export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(_error: Error): State {
    void _error;
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lesson block failed to render", error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
