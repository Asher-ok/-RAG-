import { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, InputNumber, Button, Select, Radio, Space, message, Divider, Switch, Tag, Alert, Upload, Modal, Steps, Progress } from 'antd';
import { CloseOutlined, CalculatorOutlined, UploadOutlined, DeleteOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { createFission, calculateCombinations, updateFissionProgress, completeFissionTask } from '../../services/fissionService';
import ProductSelector from '../../components/Business/ProductSelector';
import { addTaskStep, clearTaskSteps, setTaskInProgress } from '../../store/slices/fissionSlice';

const { TextArea } = Input;

function CreateFission() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [combinationsInfo, setCombinationsInfo] = useState(null);
  const [titleReplacements, setTitleReplacements] = useState([]);
  const [titleInputText, setTitleInputText] = useState('');
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const lastReportedProgressRef = useRef({ index: -1, timestamp: 0 });
  const [executionProgress, setExecutionProgress] = useState(null);
  
  // 步骤显示相关状态
  const [fissionModalVisible, setFissionModalVisible] = useState(false);
  const [fissionInProgress, setFissionInProgress] = useState(false);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const stepsContainerRef = useRef(null);
  
  // ✅ 使用 ref 保存最新的 taskId，避免闭包问题
  const currentTaskIdRef = useRef(null);
  
  // 从全局状态获取当前选中的店铺
  const currentShop = useSelector(state => state.shop.currentShop);
  const shopId = currentShop?.id;

  // ✅ 从 Redux 获取所有正在执行的任务
  const allTasksInProgress = useSelector(state => state.fission.taskInProgress || {});
  
  // ✅ 找到正在执行的任务ID（如果有）
  // 修正：允许多任务并行，不强制绑定到第一个任务，只显示当前正在操作的任务状态
  const runningTaskId = currentTaskId;
  
  // ✅ 从 Redux 获取当前任务的步骤（这样切换页面后数据不会丢失）
  const displaySteps = useSelector(state => runningTaskId ? (state.fission.taskSteps[runningTaskId] || []) : []);
  const displayInProgress = useSelector(state => runningTaskId ? (state.fission.taskInProgress[runningTaskId] || false) : false);

  // 自动滚动到最新步骤
  useEffect(() => {
    if (stepsContainerRef.current && displaySteps.length > 0) {
      stepsContainerRef.current.scrollTop = stepsContainerRef.current.scrollHeight;
    }
  }, [displaySteps]);

  // 当店铺改变时，自动更新表单中的shop_id
  useEffect(() => {
    if (shopId && shopId !== 'all') {
      form.setFieldsValue({ shop_id: shopId });
    }
  }, [shopId, form]);

  // ✅ 同步 currentTaskId 到 ref
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
  }, [currentTaskId]);

  // 监听裂变步骤进度（新增）
  useEffect(() => {
    console.log('[前端] 检查 Electron 环境...');
    console.log('[前端] window.electron:', !!window.electron);
    console.log('[前端] window.electron.ipcRenderer:', !!window.electron?.ipcRenderer);
    
    if (!window.electron || !window.electron.ipcRenderer) {
      console.warn('[前端] ⚠️ Electron 环境不可用，无法监听裂变步骤进度');
      return;
    }

    const handleStepProgress = (stepData) => {
      // ✅ 修正：从事件数据中获取 taskId（后端需要修改 handlers/fission-handler.js 传递 taskId）
      // 如果后端没传，降级使用 currentTaskIdRef
      const taskIdToStore = stepData.taskId || currentTaskIdRef.current;
      
      console.log('[前端] ✅ 收到裂变步骤:', stepData.step, 'TaskID:', taskIdToStore);
      
      if (taskIdToStore) {
        // 存储步骤到 Redux
        dispatch(addTaskStep({ task_id: taskIdToStore, step: stepData }));
        
        // 如果是完成或失败，停止进度
        if (stepData.step === '完成' || stepData.step === '异常' || stepData.status === 'failed') {
          console.log('[前端] 裂变执行结束:', taskIdToStore);
          
          // 仅当是当前查看的任务时，才更新 UI 状态
          if (taskIdToStore === currentTaskIdRef.current) {
             setFissionInProgress(false);
          }
          
          // ✅ 标记任务不再执行中
          dispatch(setTaskInProgress({ task_id: taskIdToStore, inProgress: false }));
        }
      } else {
        console.warn('[前端] ⚠️ 无法识别步骤所属任务ID，忽略');
      }
    };

    // 注册监听器
    console.log('[前端] 📡 注册 fission-step-progress 监听器');
    window.electron.ipcRenderer.on('fission-step-progress', handleStepProgress);

    // 清理函数
    return () => {
      console.log('[前端] 🧹 移除 fission-step-progress 监听器');
      window.electron.ipcRenderer.removeListener('fission-step-progress', handleStepProgress);
    };
  }, [dispatch]); // ✅ 移除 runningTaskId 依赖，确保监听器只注册一次

  // 监听裂变进度
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onFissionProgress) {
      return;
    }

    const handleProgress = async (progress) => {
      // ✅ 修正：从进度数据中获取 taskId
      const progressTaskId = progress.taskId || currentTaskIdRef.current;
      console.log('[前端] 收到裂变进度:', progress.currentIndex, 'TaskID:', progressTaskId);
      
      // 只有当前正在查看的任务才更新 UI
      if (progressTaskId === currentTaskIdRef.current) {
        setExecutionProgress(progress);
      }
      
      // 上报进度到后端（只要有 TaskID 就上报）
      if (progressTaskId) {
        // 频率控制逻辑（略微简化，每个任务独立控制会更复杂，这里暂用全局限流或简单判断）
        // 为了简单，暂时去掉复杂的 ref 检查，因为多任务混在一起 ref 会乱
        // 直接上报，后端通常能扛住
        
        try {
          await updateFissionProgress({
            task_id: progressTaskId,
            current_index: progress.currentIndex,
            current_product_title: progress.currentTitle,
            success_count: progress.successCount,
            failed_count: progress.failedCount,
            progress_percent: progress.progressPercent
          });
        } catch (error) {
          console.error('[前端] 上报进度失败:', error);
        }
      }
    };

    // 注册监听器
    window.electronAPI.onFissionProgress(handleProgress);

    // 清理函数
    return () => {
      if (window.electronAPI.offFissionProgress) {
        window.electronAPI.offFissionProgress(handleProgress);
      }
    };
  }, []); // ✅ 移除 currentTaskId 依赖，全局监听

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (selectedProducts.length === 0) {
        message.warning('请至少选择一个商品');
        return;
      }
      
      setLoading(true);
      
      // 打开步骤Modal
      setFissionModalVisible(true);
      setFissionInProgress(true);
      setCurrentProductIndex(0);
      setTotalProducts(selectedProducts.length);
      
      // 注意：这里不再清空 currentTaskId，因为可能是在并行创建
      // 但为了 UI 显示，我们会切换到新任务的视图

      // 1. 先调用后端创建任务记录
      console.log('[裂变] 选中的商品详情:', selectedProducts.map(p => ({
        id: p.id,
        product_id: p.product_id,
        douyin_product_id: p.douyin_product_id,
        title: p.title
      })));
      
      // ⚠️ 临时处理：后端暂不支持 publish_mode=3，所以下架时传2给后端，但前端自动化脚本会处理下架逻辑
      const actualPublishMode = values.publish_mode === 3 ? 2 : values.publish_mode;
      
      const requestData = {
        shop_id: values.shop_id,
        source_product_ids: selectedProducts.map(p => p.product_id),
        count: values.count,
        price_float_amount: values.price_float_amount || 0,
        title_suffix: values.title_suffix || '',
        title_replacements: titleReplacements.length > 0 ? titleReplacements : null,
        publish_mode: actualPublishMode || 2,  // ⚠️ 临时：下架时传2
        cover_image_folder: values.cover_image_folder || '',
        main_image_folder: values.main_image_folder || '',
        detail_image_folder: values.detail_image_folder || ''
      };

      console.log('[裂变] 提交数据:', requestData);
      console.log('[裂变] 选中的商品:', selectedProducts);

      const response = await createFission(requestData);

      console.log('[裂变] 后端响应:', response);

      if (response.code !== 200) {
        console.error('[裂变] 创建失败:', response);
        console.error('[裂变] 错误详情:', JSON.stringify(response, null, 2));
        if (response.errors) {
          console.error('[裂变] 验证错误:', response.errors);
        }
        if (response.data?.errors) {
          console.error('[裂变] 验证错误(data):', response.data.errors);
        }
        message.error(response.msg || response.message || '创建任务失败');
        setLoading(false);
        return;
      }

      const data = response.data;
      message.success(`已创建 ${data.success_count} 个裂变任务`);

      // 2. 逐个执行裂变任务（前端 Electron）
      // ✅ 支持并行执行：不需要 for await，直接 map 启动
      data.results.forEach(async (taskResult, index) => {
        if (!taskResult.success) return;

        let { task_id, source_product } = taskResult;
        
        // 🚨 紧急修复：如果后端返回的 task_id 为空，生成一个临时 ID
        // 这通常是后端创建任务失败但返回了 success=true，或者是并发问题
        if (!task_id) {
          console.warn(`[前端] ⚠️ 任务 ${index} 的 task_id 为空，生成临时 ID 以确保自动化运行`);
          task_id = `TEMP_TASK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // ✅ 设置当前任务ID并标记为执行中
        setCurrentTaskId(task_id);
        dispatch(setTaskInProgress({ task_id, inProgress: true }));
        dispatch(clearTaskSteps(task_id)); // 清空旧步骤
        
        // 2.1 使用抖店店铺ID作为 accountId（和商品同步一样）
        const accountId = source_product.douyin_shop_id || source_product.shop_id;
        
        console.log(`[裂变] 启动任务: ${task_id}`);
        console.log(`[裂变] 店铺ID (抖店): ${accountId}`);
        console.log(`[裂变] 店铺名称: ${source_product.shop_name}`);
        console.log(`[裂变] 使用持久化 Partition: persist:douyin-shop-${accountId}`);

        try {
          message.info(`开始执行裂变任务: ${source_product.title}`);
          
          // 设置当前任务ID（用于进度上报）
          // 注意：这里 setCurrentTaskId 可能会被覆盖，但 executionProgress 会根据 taskId 更新
          
          // 调用 Electron API 执行裂变（使用持久化 partition，不需要 storageState）
          const token = localStorage.getItem('token');
          const fissionResult = await window.electronAPI.executeFission({
            accountId: accountId,
            token: token,
            taskId: task_id,
            sourceProduct: source_product,
            count: values.count,
            priceFloatAmount: values.price_float_amount || 0,
            titleSuffix: values.title_suffix || '',
            titleReplacements: titleReplacements.length > 0 ? titleReplacements : null,
            publishMode: values.publish_mode || 2,
            coverImageFolder: values.cover_image_folder || '',
            mainImageFolder: values.main_image_folder || '',
            detailImageFolder: values.detail_image_folder || ''
          });
          
          // ... (后续处理逻辑不变)
          // ✅ 处理取消情况
          if (fissionResult.cancelled) {
            message.warning(`任务已取消: ${source_product.title}`);
            // 只有当是真实 ID 时才上报
            if (!task_id.startsWith('TEMP_TASK_')) {
              try {
                await completeFissionTask({
                  task_id: task_id,
                  success_count: fissionResult.successCount || 0,
                  failed_count: fissionResult.failedCount || 0,
                  failed_details: fissionResult.failedDetails || []
                });
              } catch (e) {
                console.error('上报取消结果失败:', e);
              }
            }
            return; // 结束当前任务
          }

          // 4. 上报最终结果到后端
          if (!task_id.startsWith('TEMP_TASK_')) {
            try {
              // 计算成功和失败的总数
              const finalSuccessCount = fissionResult.successCount || 0;
              const finalFailedCount = fissionResult.failedCount || 0;
              
              // 强制上报100%进度，确保前端状态更新为已完成
              await updateFissionProgress({
                task_id: task_id,
                current_index: values.count,
                current_product_title: '已完成',
                success_count: finalSuccessCount,
                failed_count: finalFailedCount,
                progress_percent: 100
              });
              
              await completeFissionTask({
                task_id: task_id,
                success_count: finalSuccessCount,
                failed_count: finalFailedCount,
                failed_details: fissionResult.failedDetails || []
              });
              
              // 更新本地状态，确保UI显示完成
              setExecutionProgress({
                currentIndex: values.count,
                total: values.count,
                successCount: finalSuccessCount,
                failedCount: finalFailedCount,
                currentTitle: '已完成',
                progressPercent: 100
              });
              
            } catch (e) {
              console.error('上报最终结果失败:', e);
            }
          } else {
             console.warn('[前端] 临时任务ID，跳过结果上报:', task_id);
          }

          if (fissionResult.success) {
            message.success(`任务完成: ${source_product.title} (成功${fissionResult.successCount}个)`);
          } else {
            message.error(`任务失败: ${source_product.title} - ${fissionResult.message}`);
          }

        } catch (error) {
          console.error(`执行裂变任务失败:`, error);
          message.error(`执行失败: ${source_product.title}`);
          
          // 上报失败结果
          if (!task_id.startsWith('TEMP_TASK_')) {
            try {
              await completeFissionTask({
                task_id: task_id,
                success_count: 0,
                failed_count: values.count,
                failed_details: [{ reason: error.message }]
              });
            } catch (e) {
              console.error('上报失败结果失败:', e);
            }
          }
        } finally {
          // 如果当前显示的还是这个任务，则清空进度显示
          if (currentTaskIdRef.current === task_id) {
             setExecutionProgress(null);
          }
        }
      });
      
      // ✅ 批量提交后，不需要等待所有任务完成才解锁
      // 让 setFissionInProgress(false) 在单个任务完成时触发（如果那是当前显示的任务）
      // 但为了能继续操作，这里可以不等待，或者设置 loading = false
      setLoading(false);
      
      message.success('已启动后台裂变任务，您可以继续操作');
      
      // 不再强制跳转，让用户决定
      // setTimeout(() => {
      //   navigate('/fission/tasks');
      // }, 1500);

    } catch (error) {
      console.error('[裂变] 异常错误:', error);
      console.error('[裂变] 错误详情:', JSON.stringify(error, null, 2));
      console.error('[裂变] 错误对象完整信息:', {
        message: error.message,
        code: error.code,
        msg: error.msg,
        data: error.data,
        errors: error.errors,
        response: error.response,
        stack: error.stack
      });
      
      // 显示详细错误信息
      let errorMsg = '创建失败，请重试';
      if (error.msg) {
        errorMsg = error.msg;
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      // 如果有验证错误，显示详细信息
      if (error.data?.errors && Array.isArray(error.data.errors)) {
        const errorDetails = error.data.errors.map(e => e.msg || e.message || JSON.stringify(e)).join('; ');
        errorMsg += `: ${errorDetails}`;
      } else if (error.errors && Array.isArray(error.errors)) {
        const errorDetails = error.errors.map(e => e.msg || e.message || JSON.stringify(e)).join('; ');
        errorMsg += `: ${errorDetails}`;
      }
      
      message.error(errorMsg);
    } finally {
      setLoading(false);
      setFissionInProgress(false);
    }
  };

  // 多选商品回调
  const handleMultiSelect = (products) => {
    setSelectedProducts(products);
    message.success(`已选择 ${products.length} 个商品`);
  };

  // 移除商品
  const handleRemoveProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.product_id !== productId));
  };

  // 计算组合数
  const handleCalculateCombinations = async () => {
    try {
      const values = form.getFieldsValue(['cover_image_folder', 'main_image_folder', 'detail_image_folder']);
      
      if (!values.cover_image_folder || !values.main_image_folder || !values.detail_image_folder) {
        message.warning('请先选择所有素材文件夹');
        return;
      }
      
      setCalculating(true);
      
      // 使用Electron API在本地计算（不需要后端）
      if (window.electronAPI && window.electronAPI.calculateCombinations) {
        const result = await window.electronAPI.calculateCombinations({
          coverImageFolder: values.cover_image_folder,
          mainImageFolder: values.main_image_folder,
          detailImageFolder: values.detail_image_folder
        });
        
        if (result.success) {
          setCombinationsInfo(result.data);
          message.success('计算成功');
        } else {
          message.error(result.message || '计算失败');
        }
      } else {
        // 如果不在Electron环境中，提示用户
        message.warning('此功能需要在桌面应用中使用');
      }
    } catch (error) {
      console.error(error);
      message.error('计算失败，请检查文件夹路径是否正确');
    } finally {
      setCalculating(false);
    }
  };

  // 文件夹变化时清空组合数信息
  const handleFolderChange = () => {
    setCombinationsInfo(null);
  };

  // 处理标题文本输入（粘贴或手动输入）
  const handleTitleTextChange = (e) => {
    setTitleInputText(e.target.value);
  };

  // ✅ 自动解析标题（失焦时触发）
  const handleTitleTextBlur = () => {
    if (!titleInputText.trim()) {
      return; // 空内容不处理
    }

    const lines = titleInputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      return; // 没有有效内容不处理
    }

    // 自动导入
    setTitleReplacements(lines);
    setTitleInputText('');
    message.success(`已自动导入 ${lines.length} 个标题`);
  };

  // 解析标题文本（按行分割）- 保留手动按钮功能
  const parseTitleText = () => {
    if (!titleInputText.trim()) {
      message.warning('请输入标题内容');
      return;
    }

    const lines = titleInputText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) {
      message.warning('没有有效的标题内容');
      return;
    }

    setTitleReplacements(lines);
    setTitleInputText('');
    message.success(`已导入 ${lines.length} 个标题`);
  };

  // 导入TXT文件
  const handleImportTxtFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length === 0) {
        message.warning('文件中没有有效的标题内容');
        return;
      }

      setTitleReplacements(lines);
      message.success(`已从文件导入 ${lines.length} 个标题`);
    };
    reader.readAsText(file, 'UTF-8');
    return false; // 阻止自动上传
  };

  // 删除单个标题
  const handleRemoveTitle = (index) => {
    setTitleReplacements(prev => prev.filter((_, i) => i !== index));
  };

  // 清空所有标题
  const handleClearTitles = () => {
    setTitleReplacements([]);
    message.success('已清空所有标题');
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>创建裂变</h2>
      
      {/* 实时进度显示 */}
      {executionProgress && (
        <Card style={{ marginBottom: 16, background: '#f0f7ff', borderColor: '#1890ff' }}>
          <div style={{ padding: 8 }}>
            <p style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 600, color: '#1890ff' }}>
              🚀 正在执行裂变...
            </p>
            <p style={{ margin: '4px 0', fontSize: 14, color: '#666' }}>
              当前进度: {executionProgress.currentIndex} / {executionProgress.total} ({executionProgress.progressPercent}%)
            </p>
            <p style={{ margin: '4px 0', fontSize: 14, color: '#666' }}>
              当前商品: {executionProgress.currentTitle}
            </p>
            <p style={{ margin: '4px 0', fontSize: 14 }}>
              <span style={{ color: '#52c41a', marginRight: 16 }}>✓ 成功: {executionProgress.successCount}</span>
              <span style={{ color: '#ff4d4f' }}>✗ 失败: {executionProgress.failedCount}</span>
            </p>
            <div style={{ marginTop: 8, height: 8, background: '#e6f7ff', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ 
                width: `${executionProgress.progressPercent}%`, 
                height: '100%', 
                background: '#1890ff',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </Card>
      )}
      
      {!shopId ? (
        <Card>
          <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
            <p style={{ fontSize: 16 }}>请先在顶部选择店铺</p>
          </div>
        </Card>
      ) : shopId === 'all' ? (
        <Card>
          <div style={{ padding: 40, textAlign: 'center', color: '#ff9800' }}>
            <p style={{ fontSize: 16 }}>创建裂变任务需要选择具体店铺</p>
            <p style={{ fontSize: 14, color: '#999', marginTop: 8 }}>请在顶部选择一个具体的店铺后再创建裂变任务</p>
          </div>
        </Card>
      ) : (
        <Card>
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              shop_id: shopId,
              count: 10,
              price_float_amount: 0,
              publish_mode: 2,
              cover_image_folder: '',
              main_image_folder: '',
              detail_image_folder: ''
            }}
          >
            {/* 隐藏的shop_id字段 */}
            <Form.Item name="shop_id" hidden>
              <Input />
            </Form.Item>

            <div style={{ marginBottom: 24, padding: 12, background: '#f0f7ff', borderRadius: 4 }}>
              <p style={{ margin: 0, color: '#1890ff', fontSize: 14 }}>
                📌 当前店铺：<strong>{currentShop?.shop_name}</strong>
              </p>
            </div>

            <Divider titlePlacement="left">基础设置</Divider>

            <Form.Item
              label="选择原商品（支持多选）"
              tooltip="选择要裂变的原商品，支持一次选择多个商品，系统会按顺序为每个商品创建裂变任务"
              required
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                <ProductSelector
                  shopId={shopId}
                  multiple={true}
                  onMultiSelect={handleMultiSelect}
                  buttonText="选择商品（多选）"
                />
                
                {selectedProducts.length > 0 && (
                  <div style={{ 
                    padding: 12, 
                    background: '#f6ffed', 
                    border: '1px solid #b7eb8f',
                    borderRadius: 4 
                  }}>
                    <p style={{ margin: '0 0 8px 0', color: '#52c41a', fontSize: 14, fontWeight: 500 }}>
                      已选择 {selectedProducts.length} 个商品：
                    </p>
                    <Space size={[8, 8]} wrap>
                      {selectedProducts.map(product => (
                        <Tag
                          key={product.product_id}
                          closable
                          onClose={() => handleRemoveProduct(product.product_id)}
                          color="success"
                          style={{ marginRight: 0 }}
                        >
                          {product.title.substring(0, 30)}...
                        </Tag>
                      ))}
                    </Space>
                  </div>
                )}
              </Space>
            </Form.Item>

            <Form.Item
              name="count"
              label="每个商品的裂变数量"
              tooltip="每个商品生成多少个新商品（建议500以内，最多1000个）"
              rules={[
                { required: true, message: '请输入裂变数量' },
                { type: 'number', min: 1, max: 1000, message: '裂变数量必须在1-1000之间' }
              ]}
            >
              <InputNumber
                style={{ width: 200 }}
                min={1}
                max={1000}
                step={1}
                placeholder="请输入裂变数量"
                suffix="个"
              />
            </Form.Item>
            <div style={{ marginTop: -16, marginBottom: 16, marginLeft: 120, fontSize: 12, color: '#999' }}>
              💡 建议：为保证性能和稳定性，建议单次裂变数量不超过500个
            </div>

            <Divider titlePlacement="left">裂变配置</Divider>

            <Form.Item
              label="1. 标题替换（循环使用）"
              tooltip="导入多个标题，裂变时会循环使用这些标题。如果不导入，则使用原商品标题"
            >
              <Space orientation="vertical" style={{ width: '100%' }}>
                {/* 文本输入区域 */}
                <div style={{ 
                  padding: 12, 
                  background: '#fafafa', 
                  border: '1px dashed #d9d9d9',
                  borderRadius: 4 
                }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#666' }}>
                    💡 每行一个标题，支持粘贴或手动输入：
                  </p>
                  <TextArea
                    value={titleInputText}
                    onChange={handleTitleTextChange}
                    onBlur={handleTitleTextBlur}
                    placeholder="例如：&#10;时尚百搭短袖&#10;纯棉透气T恤&#10;潮流印花上衣&#10;舒适休闲短袖&#10;经典圆领T恤&#10;&#10;💡 粘贴或输入后，点击外部区域自动导入"
                    rows={6}
                    style={{ marginBottom: 8 }}
                  />
                  <Space>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={parseTitleText}
                    >
                      立即导入
                    </Button>
                    <Upload
                      accept=".txt"
                      beforeUpload={handleImportTxtFile}
                      showUploadList={false}
                    >
                      <Button 
                        icon={<UploadOutlined />}
                        size="small"
                      >
                        导入TXT文件
                      </Button>
                    </Upload>
                    <span style={{ fontSize: 12, color: '#52c41a' }}>
                      💡 输入完成后点击外部区域会自动导入
                    </span>
                  </Space>
                </div>

                {/* 已导入的标题列表 */}
                {titleReplacements.length > 0 && (
                  <div style={{ 
                    padding: 12, 
                    background: '#e6f7ff', 
                    border: '1px solid #91d5ff',
                    borderRadius: 4 
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: 8 
                    }}>
                      <p style={{ margin: 0, color: '#1890ff', fontSize: 14, fontWeight: 500 }}>
                        ✓ 已导入 {titleReplacements.length} 个标题（将循环使用）：
                      </p>
                      <Button 
                        danger 
                        size="small" 
                        icon={<DeleteOutlined />}
                        onClick={handleClearTitles}
                      >
                        清空全部
                      </Button>
                    </div>
                    <div style={{ 
                      maxHeight: 200, 
                      overflowY: 'auto',
                      padding: 8,
                      background: '#fff',
                      borderRadius: 4
                    }}>
                      <Space size={[8, 8]} wrap>
                        {titleReplacements.map((title, index) => (
                          <Tag
                            key={index}
                            closable
                            onClose={() => handleRemoveTitle(index)}
                            color="blue"
                            style={{ marginRight: 0, fontSize: 13 }}
                          >
                            {index + 1}. {title.length > 30 ? title.substring(0, 30) + '...' : title}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#666' }}>
                      💡 裂变时会按顺序循环使用这些标题。例如：第1个商品用第1个标题，第2个商品用第2个标题...第{titleReplacements.length + 1}个商品又用第1个标题
                    </p>
                  </div>
                )}
              </Space>
            </Form.Item>

            <Form.Item
              name="title_suffix"
              label="2. 标题后缀（隐藏字符）"
              tooltip="在标题后添加后缀（通常是隐藏字符），系统会自动加上随机数避免重复"
            >
              <Input 
                style={{ width: 400 }} 
                placeholder="例如：‌‍‎（隐藏字符）或【特惠】、【限时】等（可选）" 
                maxLength={20}
              />
            </Form.Item>

            <div style={{ 
              padding: 12, 
              background: '#fff7e6', 
              border: '1px solid #ffd591',
              borderRadius: 4,
              marginBottom: 16
            }}>
              <p style={{ margin: 0, color: '#fa8c16', fontSize: 13 }}>
                📝 <strong>标题生成规则：</strong>
              </p>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#666', fontSize: 13 }}>
                <li>如果导入了标题替换列表：<strong>替换标题 + 标题后缀 + 随机后缀</strong></li>
                <li>如果没有导入标题替换：<strong>原商品标题 + 标题后缀 + 随机后缀</strong></li>
                <li>随机后缀由系统自动生成，确保每个标题唯一</li>
              </ul>
            </div>

            <Form.Item
              name="price_float_amount"
              label="3. 价格浮动"
              tooltip="商品价格在原价基础上随机浮动的金额（元）"
            >
              <Space>
                <Space.Compact style={{ width: 200 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={1000}
                    step={1}
                    placeholder="0"
                  />
                  <Button disabled>元</Button>
                </Space.Compact>
                <span style={{ color: '#999' }}>
                  （例如：填10，价格会在原价±10元范围内随机）
                </span>
              </Space>
            </Form.Item>

            <Divider titlePlacement="left">4. 图片素材（自动化模式必填）</Divider>

            <div style={{ 
              padding: 16, 
              background: '#e6f7ff', 
              border: '1px solid #91d5ff',
              borderRadius: 4,
              marginBottom: 16
            }}>
              <p style={{ margin: 0, color: '#1890ff', fontSize: 14 }}>
                💡 <strong>说明：</strong>选择本地素材文件夹，系统会自动从中随机选择图片，确保每个商品的图片都不完全相同
              </p>
            </div>

            <Form.Item
              label="首图文件夹"
              tooltip="选择包含首图的文件夹路径（需要1张首图）"
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="cover_image_folder" noStyle shouldUpdate>
                  <Input 
                    style={{ flex: 1 }} 
                    placeholder="例如：C:\素材\首图"
                    readOnly
                  />
                </Form.Item>
                <Button 
                  type="primary"
                  onClick={async () => {
                    if (window.electronAPI && window.electronAPI.selectFolder) {
                      const folderPath = await window.electronAPI.selectFolder();
                      if (folderPath) {
                        form.setFieldsValue({ cover_image_folder: folderPath });
                        handleFolderChange();
                        message.success(`已选择：${folderPath}`);
                      }
                    } else {
                      message.warning('请在 Electron 环境中使用此功能');
                    }
                  }}
                >
                  选择文件夹
                </Button>
              </Space.Compact>
            </Form.Item>

            <Form.Item
              label="主图2345文件夹"
              tooltip="选择包含主图的文件夹路径（需要4张主图）"
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="main_image_folder" noStyle shouldUpdate>
                  <Input 
                    style={{ flex: 1 }} 
                    placeholder="例如：C:\素材\主图2345"
                    readOnly
                  />
                </Form.Item>
                <Button 
                  type="primary"
                  onClick={async () => {
                    if (window.electronAPI && window.electronAPI.selectFolder) {
                      const folderPath = await window.electronAPI.selectFolder();
                      if (folderPath) {
                        form.setFieldsValue({ main_image_folder: folderPath });
                        handleFolderChange();
                        message.success(`已选择：${folderPath}`);
                      }
                    } else {
                      message.warning('请在 Electron 环境中使用此功能');
                    }
                  }}
                >
                  选择文件夹
                </Button>
              </Space.Compact>
            </Form.Item>

            <Form.Item
              label="详情图文件夹"
              tooltip="选择包含详情图的文件夹路径（可以有多张详情图）"
            >
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="detail_image_folder" noStyle shouldUpdate>
                  <Input 
                    style={{ flex: 1 }} 
                    placeholder="例如：C:\素材\详情图"
                    readOnly
                  />
                </Form.Item>
                <Button 
                  type="primary"
                  onClick={async () => {
                    if (window.electronAPI && window.electronAPI.selectFolder) {
                      const folderPath = await window.electronAPI.selectFolder();
                      if (folderPath) {
                        form.setFieldsValue({ detail_image_folder: folderPath });
                        handleFolderChange();
                        message.success(`已选择：${folderPath}`);
                      }
                    } else {
                      message.warning('请在 Electron 环境中使用此功能');
                    }
                  }}
                >
                  选择文件夹
                </Button>
              </Space.Compact>
            </Form.Item>

            {/* 计算组合数按钮 */}
            <Form.Item>
              <Button 
                icon={<CalculatorOutlined />}
                onClick={handleCalculateCombinations}
                loading={calculating}
                type="dashed"
                block
              >
                计算可生成的组合数
              </Button>
            </Form.Item>

            {/* 显示组合数信息 */}
            {combinationsInfo && (
              <Alert
                title="素材组合统计"
                description={
                  <div>
                    <p style={{ margin: '8px 0' }}>
                      <strong>首图：</strong>{combinationsInfo.cover_count} 张
                    </p>
                    <p style={{ margin: '8px 0' }}>
                      <strong>主图方案：</strong>{combinationsInfo.main_count} 个
                    </p>
                    <p style={{ margin: '8px 0' }}>
                      <strong>详情图方案：</strong>{combinationsInfo.detail_count} 个
                    </p>
                    <Divider style={{ margin: '12px 0' }} />
                    <p style={{ margin: '8px 0', fontSize: 16, color: '#52c41a', fontWeight: 'bold' }}>
                      <strong>总组合数：</strong>{combinationsInfo.total_combinations} 种
                    </p>
                    <p style={{ margin: '8px 0', fontSize: 12, color: '#999' }}>
                      💡 建议裂变数量不超过 {combinationsInfo.total_combinations} 个，以确保每个商品的图片组合都不重复
                    </p>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider titlePlacement="left">其他设置</Divider>

            <Form.Item
              name="publish_mode"
              label="发布模式"
              rules={[{ required: true, message: '请选择发布模式' }]}
            >
              <Radio.Group>
                <Radio value={1}>保存为草稿</Radio>
                <Radio value={2}>立即上架</Radio>
                <Radio value={3}>下架</Radio>
              </Radio.Group>
            </Form.Item>
            
            <div style={{ 
              marginTop: -16, 
              marginBottom: 16, 
              marginLeft: 120, 
              fontSize: 12, 
              color: '#ff9800',
              background: '#fff3e0',
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid #ffe0b2'
            }}>
              💡 <strong>说明：</strong>选择"下架"时，商品会以下架状态发布到抖店（自动化脚本会在提交前设置商品状态为下架）
            </div>

            <Divider />

            <div style={{ 
              padding: 16, 
              background: '#fffbe6', 
              border: '1px solid #ffe58f',
              borderRadius: 4,
              marginBottom: 24
            }}>
              <p style={{ margin: 0, color: '#faad14', fontSize: 14 }}>
                💡 <strong>裂变说明：</strong>
              </p>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#666' }}>
                <li>支持一次选择多个商品，系统会按顺序为每个商品创建裂变任务</li>
                <li>裂变会复制原商品的所有信息（类目、属性、发货时间等）</li>
                <li><strong>标题生成：</strong>如果导入了标题替换列表，会循环使用这些标题；否则使用原标题</li>
                <li><strong>标题后缀：</strong>在标题后添加后缀（通常是隐藏字符）+ 随机数，确保唯一性</li>
                <li><strong>价格浮动：</strong>在原价基础上随机浮动指定金额</li>
                <li><strong>图片组合模式：</strong>系统会预先生成所有可能的图片组合，按顺序使用，<strong>保证不重复</strong></li>
                <li>如果裂变数量超过组合数，会循环使用组合（建议不超过组合数）</li>
                <li>所有任务会自动加入队列，按先后顺序执行</li>
                <li>其他所有信息保持与原商品一致</li>
              </ul>
            </div>

            <Form.Item>
              <Space size="large">
                <Button 
                  type="primary" 
                  size="large" 
                  onClick={handleSubmit} 
                  loading={loading}
                  style={{ minWidth: 120 }}
                >
                  开始裂变
                </Button>
                {displaySteps.length > 0 && (
                  <Button 
                    size="large" 
                    onClick={() => setFissionModalVisible(true)}
                    icon={<SyncOutlined spin={displayInProgress} />}
                  >
                    查看日志 ({displaySteps.length})
                  </Button>
                )}
                <Button size="large" onClick={() => form.resetFields()}>
                  重置
                </Button>
                <Button size="large" onClick={() => navigate('/product/list')}>
                  返回商品列表
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}

      {/* 裂变步骤Modal */}
      <Modal
        title={
          <div>
            <span>裂变执行进度</span>
            {totalProducts > 1 && (
              <span style={{ marginLeft: 16, fontSize: 14, color: '#666', fontWeight: 'normal' }}>
                当前: 第 {currentProductIndex}/{totalProducts} 个商品
              </span>
            )}
          </div>
        }
        open={fissionModalVisible}
        onCancel={() => setFissionModalVisible(false)}
        footer={[
          <Button 
            key="copy" 
            onClick={() => {
              const logText = displaySteps.map(step => 
                `[${new Date(step.timestamp).toLocaleTimeString()}] ${step.step} - ${step.status}\n` +
                `消息: ${step.message}\n` +
                (step.details ? `详细信息: ${step.details}\n` : '') +
                `-------------------`
              ).join('\n');
              navigator.clipboard.writeText(logText);
              message.success('日志已复制到剪贴板');
            }}
            disabled={displaySteps.length === 0}
          >
            复制所有日志
          </Button>,
          <Button key="close" onClick={() => setFissionModalVisible(false)} disabled={displayInProgress}>
            {displayInProgress ? '执行中...' : '关闭'}
          </Button>
        ]}
        width={800}
        centered
        maskClosable={false}
      >
        {displaySteps.length === 0 && displayInProgress && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SyncOutlined spin style={{ fontSize: 32, color: '#1890ff', marginBottom: 16 }} />
            <div>正在初始化裂变流程...</div>
          </div>
        )}
        
        {displaySteps.length > 0 && (
          <div 
            ref={stepsContainerRef}
            style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              paddingRight: '10px'
            }}
          >
            <Steps
              orientation="vertical"
              current={displaySteps.length - 1}
              items={displaySteps.map((step, index) => {
                let status = 'wait';
                let icon = null;
                
                // 安全检查：确保 step.step 存在
                const stepText = step?.step || '';
                
                // 如果是分隔步骤（商品标题）
                if (stepText.includes('==========')) {
                  return {
                    title: (
                      <div style={{ 
                        fontSize: 16, 
                        fontWeight: 'bold', 
                        color: '#1890ff',
                        padding: '8px 0',
                        borderTop: index > 0 ? '2px solid #e8e8e8' : 'none',
                        marginTop: index > 0 ? '16px' : '0'
                      }}>
                        {stepText}
                      </div>
                    ),
                    description: (
                      <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                        {step?.message || ''}
                      </div>
                    ),
                    status: 'finish',
                    icon: <CheckCircleOutlined style={{ color: '#1890ff' }} />
                  };
                }
                
                if (step.status === 'success') {
                  status = 'finish';
                  icon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                } else if (step.status === 'failed') {
                  status = 'error';
                  icon = <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
                } else if (step.status === 'warning') {
                  status = 'finish';
                  icon = <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
                } else if (step.status === 'processing') {
                  status = 'process';
                  icon = <SyncOutlined spin style={{ color: '#1890ff' }} />;
                }
                
                return {
                  title: stepText,
                  status: status,
                  icon: icon,
                  description: (
                    <div>
                      <div style={{ marginBottom: 4, fontWeight: 500 }}>{step?.message || ''}</div>
                      {step.details && (
                        <div style={{ 
                          fontSize: 12, 
                          color: '#666', 
                          marginTop: 6,
                          padding: '8px 12px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          border: '1px solid #e8e8e8',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          <strong>详细信息：</strong><br/>
                          {typeof step.details === 'string' ? step.details : JSON.stringify(step.details, null, 2)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        {new Date(step.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  )
                };
              })}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

export default CreateFission;
