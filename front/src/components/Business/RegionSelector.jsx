import { Cascader } from 'antd';

/**
 * 地区选择器组件
 * 省市区三级联动
 */
function RegionSelector({ value, onChange, placeholder = "请选择地区", style, disabled, multiple = false }) {
  
  // 中国省市区数据（简化版）
  const regionOptions = [
    {
      value: '北京',
      label: '北京',
      children: [
        { value: '北京市', label: '北京市' }
      ]
    },
    {
      value: '上海',
      label: '上海',
      children: [
        { value: '上海市', label: '上海市' }
      ]
    },
    {
      value: '广东',
      label: '广东',
      children: [
        { value: '广州市', label: '广州市' },
        { value: '深圳市', label: '深圳市' },
        { value: '东莞市', label: '东莞市' },
        { value: '佛山市', label: '佛山市' }
      ]
    },
    {
      value: '浙江',
      label: '浙江',
      children: [
        { value: '杭州市', label: '杭州市' },
        { value: '宁波市', label: '宁波市' },
        { value: '温州市', label: '温州市' }
      ]
    },
    {
      value: '江苏',
      label: '江苏',
      children: [
        { value: '南京市', label: '南京市' },
        { value: '苏州市', label: '苏州市' },
        { value: '无锡市', label: '无锡市' }
      ]
    },
    {
      value: '四川',
      label: '四川',
      children: [
        { value: '成都市', label: '成都市' },
        { value: '绵阳市', label: '绵阳市' }
      ]
    },
    {
      value: '湖北',
      label: '湖北',
      children: [
        { value: '武汉市', label: '武汉市' }
      ]
    },
    {
      value: '湖南',
      label: '湖南',
      children: [
        { value: '长沙市', label: '长沙市' }
      ]
    },
    {
      value: '河南',
      label: '河南',
      children: [
        { value: '郑州市', label: '郑州市' }
      ]
    },
    {
      value: '山东',
      label: '山东',
      children: [
        { value: '济南市', label: '济南市' },
        { value: '青岛市', label: '青岛市' }
      ]
    }
  ];

  const handleChange = (selectedValues) => {
    if (multiple) {
      // 多选模式：返回城市数组
      const cities = selectedValues.map(item => item[item.length - 1]);
      onChange(cities);
    } else {
      // 单选模式：返回省市对象
      if (selectedValues && selectedValues.length >= 1) {
        onChange({
          province: selectedValues[0],
          city: selectedValues[1] || selectedValues[0]
        });
      } else {
        onChange(null);
      }
    }
  };

  return (
    <Cascader
      value={value}
      options={regionOptions}
      onChange={handleChange}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      showSearch
      multiple={multiple}
      maxTagCount="responsive"
    />
  );
}

export default RegionSelector;
