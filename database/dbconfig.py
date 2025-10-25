import mysql.connector

def get_connection():
    return mysql.connector.connect(
        host="localhost",
        user="market",
        password="market",
        database="marketdb"
    )