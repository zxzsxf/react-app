import React from 'react';
// @ts-ignore
import { Button } from 'zxz-component'
import { ReactRemoteComponent } from 'remote-component-loader';

function App() {
  console.log(ReactRemoteComponent,'ReactRemoteComponent');
  return (
    <div className="App">
      1
      {/* @ts-ignore */}
      <Button label='test'></Button>
      {/* @ts-ignore */}
      <ReactRemoteComponent name='zxz-button' version='1.0.0' componentProps={{
        label: 'test1'
      }}></ReactRemoteComponent>
    </div>
  );
}

export default App;
