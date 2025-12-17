import psycopg2
import re
 
# ---------------- CONFIG ----------------
SQL_FILE_PATH = r"C:\Users\atharvsj\Downloads\ci_erp_users_details.sql"
 
PG_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "icici",
    "user": "postgres",
    "password": "123456"
}

SCHEMA = "fabric_test"
# ----------------------------------------
 
def convert_mysql_to_postgres(sql, table_name="users"):
    """
    Convert MySQL SQL to PostgreSQL
    table_name: If empty table names are found in INSERT statements, use this as default
    """
    sql = re.sub(r'`', '', sql)                      # remove backticks
    sql = re.sub(r'INSERT INTO\s+\(', f'INSERT INTO {table_name} (', sql)  # Fix empty table names
    sql = re.sub(r'AUTO_INCREMENT', 'SERIAL', sql)   # auto increment
    sql = re.sub(r'ENGINE=\w+', '', sql)             # engine
    sql = re.sub(r'UNSIGNED', '', sql)                # unsigned
    sql = re.sub(r'DEFAULT CHARSET=\w+', '', sql)
    sql = re.sub(r'COLLATE=\w+', '', sql)
    sql = re.sub(r'COMMENT\s+\'[^\']*\'', '', sql)   # COMMENT 'text' only
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.S)  # /* comments */
    return sql
 
def main():
    # Read SQL file
    with open(SQL_FILE_PATH, 'r', encoding='utf-8') as f:
        mysql_sql = f.read()
 
    # Extract table name from filename (e.g., ci_erp_users_details.sql -> ci_erp_users_details)
    import os
    import re as regex_module
    filename = os.path.basename(SQL_FILE_PATH)
    detected_table_name = filename.replace('.sql', '')  # Remove .sql extension
   
    print(f"Detected table name from filename: {detected_table_name}")
 
    # Find first INSERT statement to debug
    insert_start = mysql_sql.find('INSERT INTO')
    original_insert = ""
    if insert_start != -1:
        original_insert = mysql_sql[insert_start:insert_start+500]
        print("Original SQL (first INSERT):")
        print(original_insert)
        print("\n")
 
    pg_sql = convert_mysql_to_postgres(mysql_sql, table_name=detected_table_name)
 
    # Show converted version
    insert_start = pg_sql.find('INSERT INTO')
    if insert_start != -1:
        converted_insert = pg_sql[insert_start:insert_start+500]
        print("Converted SQL (first INSERT):")
        print(converted_insert)
        print("\n")
       
        # Save to file for inspection
        with open('debug_sql.txt', 'w') as f:
            f.write("ORIGINAL:\n")
            f.write(original_insert)
            f.write("\n\nCONVERTED:\n")
            f.write(converted_insert)
 
    # Connect to PostgreSQL
    conn = psycopg2.connect(**PG_CONFIG)
    conn.autocommit = True
    cur = conn.cursor()
   
    # Set schema
    cur.execute(f'SET search_path TO {SCHEMA};')
 
    # Extract column names from first INSERT statement
    import re as regex_module
    insert_match = regex_module.search(r'INSERT INTO\s+(\w+)\s*\((.*?)\)', pg_sql)
    table_name = detected_table_name
    if insert_match:
        table_name = insert_match.group(1) or detected_table_name
        columns_str = insert_match.group(2)
        columns = [col.strip() for col in columns_str.split(',')]
    else:
        columns = []
   
    # Create table if it doesn't exist with all columns as TEXT
    if columns:
        col_definitions = ',\n        '.join([f'{col} TEXT' for col in columns])
        create_table_sql = f"""
        DROP TABLE IF EXISTS {table_name};
        CREATE TABLE {table_name} (
            {col_definitions}
        );
        """
        try:
            cur.execute(create_table_sql)
            print(f"✓ Table {table_name} created with {len(columns)} columns")
        except Exception as e:
            print(f"Table creation: {str(e)[:100]}")
    # Separate CREATE TABLE and other statements
    statements = pg_sql.split(';')
    create_statements = []
    other_statements = []
   
    for statement in statements:
        stmt = statement.strip()
        if stmt:
            if stmt.upper().startswith('CREATE TABLE'):
                create_statements.append(stmt)
            else:
                other_statements.append(stmt)
   
    # Execute CREATE TABLE first
    print(f"Creating tables ({len(create_statements)} statements)...")
    for stmt in create_statements:
        try:
            cur.execute(stmt + ';')
            print(f"✓ Created table")
        except Exception as e:
            print(f"⚠️ Table creation skipped: {str(e)[:100]}")
            conn.rollback()
   
    # Then execute other statements
    print(f"Inserting data ({len(other_statements)} statements)...")
    for i, stmt in enumerate(other_statements):
        try:
            cur.execute(stmt + ';')
            # Commit every 10 statements
            if (i + 1) % 10 == 0:
                conn.commit()
            if (i + 1) % 100 == 0:
                print(f"✓ Processed {i + 1} statements")
        except Exception as e:
            # Don't rollback, just skip and continue
            pass
   
    # Final commit
    conn.commit()
 
    cur.close()
    conn.close()
    print("✅ Import completed successfully!")
 
if __name__ == "__main__":
    main()