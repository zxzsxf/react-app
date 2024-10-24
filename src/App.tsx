import React from 'react';
// @ts-ignore
import { Button } from 'zxz-ui'
import { ReactRemoteComponent } from 'remote-component-loader';

function App() {
  console.log(ReactRemoteComponent,'ReactRemoteComponent');
  return (
    <div className="App">
      {/* <Button label='test'></Button> */}1
      <ReactRemoteComponent name='button' version='1.0.0' componentProps={{
        label: 'test'
      }}></ReactRemoteComponent>
    </div>
  );
}

export default App;
