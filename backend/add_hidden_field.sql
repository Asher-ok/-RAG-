-- 添加 is_hidden 字段到 tb_account_user 表
-- 用于标记隐藏的超级管理员账号

ALTER TABLE tb_account_user 
ADD COLUMN is_hidden SMALLINT NOT NULL DEFAULT 0 COMMENT '0普通账号/1隐藏账号（仅开发者可见）';

-- 更新 account_type 字段的注释（保持原有定义）
-- ALTER TABLE tb_account_user 
-- MODIFY COLUMN account_type SMALLINT NOT NULL COMMENT '1主账号/2员工账号';

-- 创建索引以提高查询性能
CREATE INDEX idx_is_hidden ON tb_account_user(is_hidden);

-- 查看表结构
DESC tb_account_user;
