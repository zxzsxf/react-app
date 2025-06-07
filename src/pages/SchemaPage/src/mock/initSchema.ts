export const schemas = {
    type: 'object',
    properties: {
      'Group_1': {
        type: 'object',
        properties: {
          DatePicker: {
            type: 'string',
            'x-component': 'DatePicker',
          },
        },
        'x-component': 'Card',
      },
      'Group_2': {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            'x-component': 'Input',
          },
        },
        'x-component': 'Card',
      },
      'Group_3': {
        type: 'object',
        properties: {
          DatePicker: {
            type: 'string',
            'x-component': 'DatePicker',
          },
        },
        'x-component': 'Card',
      },
      'Group_4': {
        type: 'object',
        properties: {
          Button: {
            type: 'string',
            'x-component': 'Button',
            'x-component-props': {
              type: 'primary',
              onClick: () => {
                console.log('click')
              },
              text: '提交'
            }
          },
        },
        'x-component': 'Card',
      },
    },
  }
  