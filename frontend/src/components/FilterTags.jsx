import React, { useState } from 'react';
import { Tag, Space, Button, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

/**
 * 美化的标签过滤器组件
 */
export default function FilterTags({
  tags = [],
  onTagSelect = () => {},
  onTagRemove = () => {},
  multiSelect = false,
  maxTags = null,
  colorMap = {},
  showCount = false
}) {
  const [selected, setSelected] = useState([]);

  const handleTagClick = (tag) => {
    let newSelected;
    if (multiSelect) {
      if (selected.includes(tag)) {
        newSelected = selected.filter(t => t !== tag);
      } else {
        if (maxTags && selected.length >= maxTags) {
          return;
        }
        newSelected = [...selected, tag];
      }
    } else {
      newSelected = selected.includes(tag) ? [] : [tag];
    }
    setSelected(newSelected);
    onTagSelect(newSelected);
  };

  const handleRemove = (tag) => {
    const newSelected = selected.filter(t => t !== tag);
    setSelected(newSelected);
    onTagRemove(tag);
    onTagSelect(newSelected);
  };

  const getColor = (tag) => {
    return colorMap[tag] || '#1677ff';
  };

  return (
    <Space wrap>
      {tags.map((tag) => {
        const isSelected = selected.includes(tag);
        const color = getColor(tag);

        return (
          <Tooltip key={tag} title={showCount ? `点击选择 "${tag}"` : ''}>
            <Tag
              onClick={() => handleTagClick(tag)}
              style={{
                background: isSelected
                  ? `${color}20`
                  : '#f5f7fb',
                color: isSelected ? color : '#595959',
                border: isSelected
                  ? `1.5px solid ${color}`
                  : '1px solid #d9d9d9',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: isSelected ? 600 : 500,
                transition: 'all 0.2s ease',
                userSelect: 'none',
                whiteSpace: 'nowrap'
              }}
              icon={isSelected && <CloseOutlined style={{ fontSize: '10px', marginRight: '4px' }} />}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {tag}
            </Tag>
          </Tooltip>
        );
      })}
    </Space>
  );
}

/**
 * 多选过滤条件组件
 */
export function FilterGroup({
  title = '筛选条件',
  filters = [],
  onFilterChange = () => {},
  layout = 'horizontal' // horizontal | vertical
}) {
  const [selectedFilters, setSelectedFilters] = useState({});

  const handleFilterChange = (filterKey, values) => {
    const newFilters = {
      ...selectedFilters,
      [filterKey]: values
    };
    setSelectedFilters(newFilters);
    onFilterChange(newFilters);
  };

  const containerStyle = layout === 'vertical'
    ? { display: 'flex', flexDirection: 'column', gap: '16px' }
    : { display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' };

  return (
    <div style={{ ...containerStyle }}>
      {title && (
        <span style={{
          fontWeight: 600,
          color: '#1a1a1a',
          fontSize: '14px',
          minWidth: '60px'
        }}>
          {title}
        </span>
      )}
      {filters.map((filter) => (
        <div key={filter.key} style={layout === 'vertical' ? { width: '100%' } : {}}>
          <FilterTags
            tags={filter.options}
            onTagSelect={(selected) => handleFilterChange(filter.key, selected)}
            multiSelect={filter.multiSelect !== false}
            colorMap={filter.colorMap}
          />
        </div>
      ))}
    </div>
  );
}
