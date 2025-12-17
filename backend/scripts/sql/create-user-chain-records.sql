-- User Chain Records Table
-- Stores user data with blockchain proof (hash + transaction ID)

CREATE TABLE IF NOT EXISTS fabric_test.user_chain_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    data_json JSONB NOT NULL,
    hash_value VARCHAR(200),
    blockchain_tx_id VARCHAR(200),
    operation_type VARCHAR(20) DEFAULT 'INSERT',
    blockchain_status CHAR(1) DEFAULT 'P',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Prevent duplicate entries with same user and hash
    CONSTRAINT unique_user_operation UNIQUE (user_id, hash_value)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_chain_records_user_id 
ON fabric_test.user_chain_records(user_id);

CREATE INDEX IF NOT EXISTS idx_user_chain_records_hash 
ON fabric_test.user_chain_records(hash_value);

CREATE INDEX IF NOT EXISTS idx_user_chain_records_created 
ON fabric_test.user_chain_records(created_at);

CREATE INDEX IF NOT EXISTS idx_user_chain_records_operation 
ON fabric_test.user_chain_records(operation_type);

CREATE INDEX IF NOT EXISTS idx_user_chain_records_status 
ON fabric_test.user_chain_records(blockchain_status);

-- Comments
COMMENT ON TABLE fabric_test.user_chain_records IS 'Stores user data with blockchain proof for audit trail';
COMMENT ON COLUMN fabric_test.user_chain_records.id IS 'Unique UUID for this record';
COMMENT ON COLUMN fabric_test.user_chain_records.user_id IS 'Reference to ci_erp_users.user_id';
COMMENT ON COLUMN fabric_test.user_chain_records.data_json IS 'Complete user data snapshot as JSON';
COMMENT ON COLUMN fabric_test.user_chain_records.hash_value IS 'SHA-256 hash of data_json';
COMMENT ON COLUMN fabric_test.user_chain_records.blockchain_tx_id IS 'Blockchain transaction hash';
COMMENT ON COLUMN fabric_test.user_chain_records.operation_type IS 'Type: INSERT, UPDATE, DELETE, INITIAL_MIGRATION';
COMMENT ON COLUMN fabric_test.user_chain_records.blockchain_status IS 'Status: P=Pending, A=Approved, R=Rejected';
