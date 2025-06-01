import React, { useEffect, useState } from 'react';
import { Table } from 'antd';
import axios from 'axios';

interface ComponentInfo {
  path: string;
  time: string;
  version: string;
}

interface ComponentsData {
  [key: string]: ComponentInfo[];
}

const ConfigPage: React.FC = () => {
  const [componentsData, setComponentsData] = useState<ComponentsData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:4000/components-info');
        setComponentsData(response.data);
      } catch (error) {
        console.error('Failed to fetch components info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns = [
    {
      title: '组件路径',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: '时间戳',
      dataIndex: 'time',
      key: 'time',
      render: (time: string) => new Date(parseInt(time)).toLocaleString(),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
    },
  ];

  const processDataForTable = () => {
    return Object.entries(componentsData).map(([componentName, versions]) => ({
      key: componentName,
      name: componentName,
      children: versions.map((version, index) => ({
        ...version,
        key: `${componentName}-${index}`,
      })),
    }));
  };

  return (
    <div>
      <h2>组件配置信息</h2>
      <Table
        loading={loading}
        columns={columns}
        dataSource={processDataForTable()}
        expandable={{
          defaultExpandAllRows: true,
        }}
      />
    </div>
  );
};

export default ConfigPage;