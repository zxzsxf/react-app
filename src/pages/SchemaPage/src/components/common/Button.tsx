import React from 'react';
import { Button as AntdButton } from 'antd';

const Button: React.FC<any> = ({ type, onClick, children, text = 'antd button' }) => {
  return (
    <AntdButton type={type} onClick={onClick}>
      {text}
      {children}
    </AntdButton>
  );
};
export default Button;

// import { Button } from 'antd';
// export default Button;