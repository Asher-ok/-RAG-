"""
账号Cookie管理器
负责多账号的Cookie持久化存储和加载
"""
import json
import os
from pathlib import Path
from typing import Optional, Dict, List
from datetime import datetime


class AccountManager:
    """账号Cookie管理器"""
    
    def __init__(self, states_dir: str = "states"):
        """
        初始化账号管理器
        
        Args:
            states_dir: Cookie存储根目录
        """
        from pathlib import Path
        import os
        
        # 确保使用绝对路径
        if not os.path.isabs(states_dir):
            # 相对于项目根目录（backend的上一级）
            base_dir = Path(__file__).parent.parent.parent.parent  # 从 backend/app/playwright/ 到项目根目录
            self.states_dir = base_dir / states_dir
        else:
            self.states_dir = Path(states_dir)
        
        # 创建目录（如果不存在）
        try:
            self.states_dir.mkdir(parents=True, exist_ok=True)
            print(f"✓ States目录: {self.states_dir}")
        except Exception as e:
            print(f"✗ 创建states目录失败: {str(e)}")
            raise
    
    def get_account_state_path(self, account_id: str) -> Path:
        """
        获取账号状态文件路径
        
        Args:
            account_id: 账号ID
            
        Returns:
            状态文件路径
        """
        account_dir = self.states_dir / f"account_{account_id}"
        # 确保账号目录存在
        account_dir.mkdir(parents=True, exist_ok=True)
        return account_dir / "state.json"
    
    def save_state(self, account_id: str, state_data: Dict) -> bool:
        """
        保存账号状态（Cookie等）
        
        Args:
            account_id: 账号ID
            state_data: 状态数据（包含cookies、localStorage等）
            
        Returns:
            是否保存成功
        """
        try:
            state_path = self.get_account_state_path(account_id)
            
            # 添加元数据
            state_with_meta = {
                "account_id": account_id,
                "saved_at": datetime.now().isoformat(),
                "state": state_data
            }
            
            with open(state_path, 'w', encoding='utf-8') as f:
                json.dump(state_with_meta, f, ensure_ascii=False, indent=2)
            
            print(f"✓ 账号 {account_id} 状态已保存到: {state_path}")
            return True
            
        except Exception as e:
            print(f"✗ 保存账号 {account_id} 状态失败: {str(e)}")
            return False
    
    def load_state(self, account_id: str) -> Optional[Dict]:
        """
        加载账号状态
        
        Args:
            account_id: 账号ID
            
        Returns:
            状态数据，如果不存在返回None
        """
        try:
            state_path = self.get_account_state_path(account_id)
            
            if not state_path.exists():
                print(f"⚠ 账号 {account_id} 状态文件不存在")
                return None
            
            with open(state_path, 'r', encoding='utf-8') as f:
                state_with_meta = json.load(f)
            
            print(f"✓ 账号 {account_id} 状态已加载 (保存于: {state_with_meta.get('saved_at')})")
            return state_with_meta.get('state')
            
        except Exception as e:
            print(f"✗ 加载账号 {account_id} 状态失败: {str(e)}")
            return None
    
    def has_state(self, account_id: str) -> bool:
        """
        检查账号是否已有保存的状态
        
        Args:
            account_id: 账号ID
            
        Returns:
            是否存在状态文件
        """
        state_path = self.get_account_state_path(account_id)
        return state_path.exists()
    
    def delete_state(self, account_id: str) -> bool:
        """
        删除账号状态
        
        Args:
            account_id: 账号ID
            
        Returns:
            是否删除成功
        """
        try:
            state_path = self.get_account_state_path(account_id)
            
            if state_path.exists():
                state_path.unlink()
                print(f"✓ 账号 {account_id} 状态已删除")
                return True
            else:
                print(f"⚠ 账号 {account_id} 状态文件不存在")
                return False
                
        except Exception as e:
            print(f"✗ 删除账号 {account_id} 状态失败: {str(e)}")
            return False
    
    def list_accounts(self) -> List[Dict]:
        """
        列出所有已保存状态的账号
        
        Returns:
            账号列表，包含账号ID和保存时间
        """
        accounts = []
        
        try:
            for account_dir in self.states_dir.iterdir():
                if account_dir.is_dir() and account_dir.name.startswith("account_"):
                    state_path = account_dir / "state.json"
                    
                    if state_path.exists():
                        try:
                            with open(state_path, 'r', encoding='utf-8') as f:
                                state_data = json.load(f)
                            
                            accounts.append({
                                "account_id": state_data.get("account_id"),
                                "saved_at": state_data.get("saved_at"),
                                "state_path": str(state_path)
                            })
                        except:
                            continue
            
            return accounts
            
        except Exception as e:
            print(f"✗ 列出账号失败: {str(e)}")
            return []
    
    def get_state_info(self, account_id: str) -> Optional[Dict]:
        """
        获取账号状态信息（不加载完整状态）
        
        Args:
            account_id: 账号ID
            
        Returns:
            状态信息（元数据）
        """
        try:
            state_path = self.get_account_state_path(account_id)
            
            if not state_path.exists():
                return None
            
            with open(state_path, 'r', encoding='utf-8') as f:
                state_with_meta = json.load(f)
            
            return {
                "account_id": state_with_meta.get("account_id"),
                "saved_at": state_with_meta.get("saved_at"),
                "has_cookies": "cookies" in state_with_meta.get("state", {}),
                "state_path": str(state_path)
            }
            
        except Exception as e:
            print(f"✗ 获取账号 {account_id} 状态信息失败: {str(e)}")
            return None
