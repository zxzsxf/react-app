'use strict';

var React = require('react');
var reactErrorBoundary = require('react-error-boundary');
var core = require('@formily/core');
var react = require('@formily/react');
var reactive = require('@formily/reactive');
var components = require('flowform-component');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var components__namespace = /*#__PURE__*/_interopNamespaceDefault(components);

const SchemaField = react.createSchemaField({ components: {
        Input: components__namespace.Input,
        InputNumber: components__namespace.InputNumber,
        TextArea: components__namespace.TextArea,
        Select: components__namespace.Select,
        Checkbox: components__namespace.Checkbox,
        CheckboxGroup: components__namespace.CheckboxGroup,
        Radio: components__namespace.Radio,
        RadioGroup: components__namespace.RadioGroup,
        DatePicker: components__namespace.DatePicker,
        Switch: components__namespace.Switch,
        Upload: components__namespace.Upload,
        FormItem: components__namespace.FormItem,
    } });
const { Form } = components__namespace;
const FlowFormRenderer = ({ schema, initialValues, onChange, formRef, children }) => {
    const onChangeRef = React.useRef(onChange);
    React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
    const form = React.useMemo(() => core.createForm({
        initialValues: initialValues || {},
        effects() {
            core.onFormValuesChange(current => onChangeRef.current?.(reactive.toJS(current.values)));
        },
    }), []);
    React.useEffect(() => {
        if (formRef)
            formRef.current = form;
        return () => { if (formRef && formRef.current === form)
            formRef.current = null; };
    }, [form, formRef]);
    return (React.createElement(react.FormProvider, { form: form },
        React.createElement(Form, { labelCol: 6, wrapperCol: 12 },
            React.createElement(SchemaField, { schema: schema }),
            children)));
};

/** Legacy factory accepting the existing `{ schemas }` envelope. */
const createFlowForm = (formSchema) => {
    const LegacyForm = ({ value, ...props }) => (React.createElement(FlowFormRenderer, { ...props, initialValues: value, schema: formSchema?.schemas || {} }));
    return reactErrorBoundary.withErrorBoundary(LegacyForm, {
        fallback: React.createElement("div", { style: { color: "red" } }, "\u8868\u5355\u6E32\u67D3\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\uFF01"),
    });
};

exports.FlowFormRenderer = FlowFormRenderer;
exports.createFlowForm = createFlowForm;

