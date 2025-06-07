import React from 'react';

interface CardProps {
  title?: string;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ title, children }) => {
  return (
    <div
      style={{ marginBottom: 16 }}
    >
      <div>this is card</div>
      <div>{children}</div>
    </div>
  );
};

export default Card;
