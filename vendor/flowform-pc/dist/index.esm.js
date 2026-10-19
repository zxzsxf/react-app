import React, { useRef, useEffect, useMemo } from 'react';
import { withErrorBoundary } from 'react-error-boundary';
import { createForm, onFormValuesChange } from '@formily/core';
import { createSchemaField, FormProvider } from '@formily/react';
import { toJS } from '@formily/reactive';
import * as components from 'flowform-component';

const SchemaField = createSchemaField({ components: {
        Input: components.Input,
        InputNumber: components.InputNumber,
        TextArea: components.TextArea,
        Select: components.Select,
        Checkbox: components.Checkbox,
        CheckboxGroup: components.CheckboxGroup,
        Radio: components.Radio,
        RadioGroup: components.RadioGroup,
        DatePicker: components.DatePicker,
        Switch: components.Switch,
        Upload: components.Upload,
        FormItem: components.FormItem,
    } });
const { Form } = components;
const FlowFormRenderer = ({ schema, initialValues, onChange, formRef, children }) => {
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    const form = useMemo(() => createForm({
        initialValues: initialValues || {},
        effects() {
            onFormValuesChange(current => onChangeRef.current?.(toJS(current.values)));
        },
    }), []);
    useEffect(() => {
        if (formRef)
            formRef.current = form;
        return () => { if (formRef && formRef.current === form)
            formRef.current = null; };
    }, [form, formRef]);
    return (React.createElement(FormProvider, { form: form },
        React.createElement(Form, { labelCol: 6, wrapperCol: 12 },
            React.createElement(SchemaField, { schema: schema }),
            children)));
};

/** Legacy factory accepting the existing `{ schemas }` envelope. */
const createFlowForm = (formSchema) => {
    const LegacyForm = ({ value, ...props }) => (React.createElement(FlowFormRenderer, { ...props, initialValues: value, schema: formSchema?.schemas || {} }));
    return withErrorBoundary(LegacyForm, {
        fallback: React.createElement("div", { style: { color: "red" } }, "\u8868\u5355\u6E32\u67D3\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\uFF01"),
    });
};

export { FlowFormRenderer, createFlowForm };

