-- Add blockchain_status column to existing user_chain_records table
-- Run this if the table already exists

-- Add the column
ALTER TABLE fabric_test.user_chain_records 
ADD COLUMN IF NOT EXISTS blockchain_status CHAR(1) DEFAULT 'P';

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_user_chain_records_status 
ON fabric_test.user_chain_records(blockchain_status);

-- Add comment
COMMENT ON COLUMN fabric_test.user_chain_records.blockchain_status IS 'Status: P=Pending, A=Approved, R=Rejected';

-- Update existing records to 'P' (Pending) if they have null status
UPDATE fabric_test.user_chain_records 
SET blockchain_status = 'P' 
WHERE blockchain_status IS NULL;
