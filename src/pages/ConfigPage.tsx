import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, message } from 'antd';
import axios from 'axios';

interface PublishInfo {
  publisher: string;
  publishTime: string;
  description: string;
  buildInfo?: string;
  status: string;
}

interface BuildDetails {
  componentName?: string;
  version?: string;
  buildTime?: string;
  gitCommit?: string;
  gitBranch?: string;
  buildInfo?: string;
}

interface Metadata {
  name: string;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  author: string;
  license: string;
  repository: {
    type: string;
    url: string;
  };
}

interface ComponentInfo {
  path: string;
  time: string;
  version: string;
  publishInfo: PublishInfo;
  buildDetails?: BuildDetails;
  metadata?: Metadata;
}

interface ComponentsData {
  [key: string]: ComponentInfo[];
}

const ConfigPage: React.FC = () => {
  const [componentsData, setComponentsData] = useState<ComponentsData>({});
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<Record<string, boolean>>({});

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

  const handlePublish = async (componentName: string, path: string, version: string) => {
    try {
      setPublishing(prev => ({ ...prev, [`${componentName}-${version}`]: true }));
      await axios.post('http://localhost:4000/components/publish', {
        componentName,
        path,
        version
      });
      message.success('发布成功');
      // 刷新数据
      const response = await axios.get('http://localhost:4000/components-info');
      setComponentsData(response.data);
    } catch (error) {
      console.error('发布失败:', error);
      message.error('发布失败');
    } finally {
      setPublishing(prev => ({ ...prev, [`${componentName}-${version}`]: false }));
    }
  };

  const columns = [
    {
      title: '组件名',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '组件路径',
      dataIndex: 'path',
      key: 'path',
      width: 300,
      ellipsis: true,
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 120,
      render: (version: string) => {
        if (!version) return null;
        return <Tag color={version && typeof version === 'string' && version.includes('beta') ? 'orange' : 'blue'}>
          {version}
        </Tag>
      },
    },
    {
      title: '发布时间',
      dataIndex: ['publishInfo', 'publishTime'],
      key: 'publishTime',
      width: 180,
      render: (time: string) => {
        return time ? new Date(parseInt(time)).toLocaleString() : '';
      },
    },
    {
      title: '发布者',
      dataIndex: ['publishInfo', 'publisher'],
      key: 'publisher',
      width: 100,
    },
    {
      title: '发布说明',
      dataIndex: ['publishInfo', 'description'],
      key: 'description',
      width: 200,
    },
    {
      title: '构建时间',
      dataIndex: ['buildDetails', 'buildTime'],
      key: 'buildTime',
      width: 180,
    },
    // {
    //   title: 'Git 分支',
    //   dataIndex: ['buildDetails', 'gitBranch'],
    //   key: 'gitBranch',
    //   width: 120,
    // },
    // {
    //   title: 'Git 提交',
    //   dataIndex: ['buildDetails', 'gitCommit'],
    //   key: 'gitCommit',
    //   width: 180,
    //   ellipsis: true,
    // },
    {
      title: '状态',
      dataIndex: ['publishInfo', 'status'],
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'published' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => {
        if (record.children) return null;
        
        return (
          <Button
            type="primary"
            size="small"
            loading={publishing[`${record.name}-${record.version}`]}
            onClick={() => handlePublish(record.name, record.path, record.version)}
            // disabled={record.publishInfo?.status === 'published'}
          >
            发布
          </Button>
        );
      },
    },
  ];

  const processDataForTable = () => {
    return Object.entries(componentsData).map(([componentName, versions]) => ({
      key: componentName,
      name: componentName,
      children: versions.map((version, index) => ({
        ...version,
        key: `${componentName}-${index}`,
        name: componentName,
      })),
    }));
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>组件配置信息</h2>
      <Table
        loading={loading}
        columns={columns}
        dataSource={processDataForTable()}
        expandable={{
          defaultExpandAllRows: true,
        }}
        bordered
        size="middle"
        scroll={{ x: 1500 }}
        pagination={{
          defaultPageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        style={{ background: '#fff' }}
      />
    </div>
  );
};

export default ConfigPage;