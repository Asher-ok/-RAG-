import { useState, useEffect } from 'react';
import { Cascader, Spin } from 'antd';

/**
 * 类目选择器组件
 * 三级类目级联选择
 * 
 * TODO: 需要对接抖音API获取真实类目树
 * 目前使用模拟数据
 */
function CategorySelector({ value, onChange, placeholder = "请选择类目", style, disabled }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      // TODO: 调用后端接口获取抖音类目树
      // const response = await getCategoryTree();
      
      // 模拟数据
      const mockCategories = [
        {
          value: '20100',
          label: '服饰内衣',
          children: [
            {
              value: '20101',
              label: '女装',
              children: [
                { value: '20102', label: '连衣裙' },
                { value: '20103', label: 'T恤' },
                { value: '20104', label: '衬衫' }
              ]
            },
            {
              value: '20105',
              label: '男装',
              children: [
                { value: '20106', label: 'T恤' },
                { value: '20107', label: '衬衫' },
                { value: '20108', label: '裤子' }
              ]
            }
          ]
        },
        {
          value: '20200',
          label: '鞋靴箱包',
          children: [
            {
              value: '20201',
              label: '女鞋',
              children: [
                { value: '20202', label: '高跟鞋' },
                { value: '20203', label: '平底鞋' },
                { value: '20204', label: '运动鞋' }
              ]
            },
            {
              value: '20205',
              label: '男鞋',
              children: [
                { value: '20206', label: '皮鞋' },
                { value: '20207', label: '运动鞋' },
                { value: '20208', label: '休闲鞋' }
              ]
            }
          ]
        },
        {
          value: '20300',
          label: '美妆个护',
          children: [
            {
              value: '20301',
              label: '护肤',
              children: [
                { value: '20302', label: '面膜' },
                { value: '20303', label: '精华' },
                { value: '20304', label: '乳液' }
              ]
            }
          ]
        }
      ];

      setOptions(mockCategories);
    } catch (error) {
      console.error('加载类目失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (selectedValues) => {
    if (selectedValues && selectedValues.length === 3) {
      onChange({
        first_cid: selectedValues[0],
        second_cid: selectedValues[1],
        third_cid: selectedValues[2]
      });
    } else {
      onChange(null);
    }
  };

  // 将value转换为cascader需要的格式
  const cascaderValue = value && value.first_cid && value.second_cid && value.third_cid
    ? [value.first_cid, value.second_cid, value.third_cid]
    : undefined;

  return (
    <Cascader
      value={cascaderValue}
      options={options}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      showSearch
      notFoundContent={loading ? <Spin size="small" /> : '暂无类目'}
      expandTrigger="hover"
    />
  );
}

export default CategorySelector;
