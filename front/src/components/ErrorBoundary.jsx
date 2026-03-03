import React from 'react';
import { Result, Button } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 你同样可以将错误日志上报给服务器
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI 并渲染
      return (
        <Result
          status="error"
          title="页面出现错误"
          subTitle="抱歉，页面出现了一些问题。请刷新页面重试。"
          extra={[
            <Button type="primary" key="refresh" onClick={() => window.location.reload()}>
              刷新页面
            </Button>,
            <Button key="back" onClick={() => window.history.back()}>
              返回上页
            </Button>
          ]}
        >
          {process.env.NODE_ENV === 'development' && (
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary>错误详情（开发模式）</summary>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </details>
            </div>
          )}
        </Result>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;