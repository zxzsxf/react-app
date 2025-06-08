// @ts-nocheck
import { FormLayout } from '@formily/antd';
import { createForm, Form } from '@formily/core';
import { connect, FormProvider, mapProps, createSchemaField } from '@formily/react';
import * as React from 'react';
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
// antd组件
import { Input, Switch, DatePicker } from 'antd';
// 工程组件
import Card from './components/common/Card';
import Button from './components/common/Button';
// 微件
// ...待补充

// mock数据
import { schemas } from './mock/initSchema'

let SchemaField = null;

const BaseForm = () => {
  const [componentsLoaded, setComponentsLoaded] = React.useState(false);
  const [formSchemas, setFormSchemas] = React.useState<Object>({});

  useEffect(() => {
    setFormSchemas(schemas);
    setComponentsLoaded(true);
  }, []);

  const form: Form = useMemo(
    () =>
      createForm({
        values: {},
      }),
    []
  );
  SchemaField = createSchemaField({
    components: {
      Input,
      Switch,
      Card,
      Button,
      DatePicker
    },
  })
  
  useEffect(() => {
    // 动态导入组件并注册到SchemaField
    setTimeout(() => {
      // SchemaField = registerSchemaField(componentsData || componentsDataDefault)
      setComponentsLoaded(true);
    },100)
  }, []);

  return (
    <FormProvider form={form}>
      <SchemaField
        schema={formSchemas}
      ></SchemaField>
    </FormProvider>
  );

}

export default BaseForm;
