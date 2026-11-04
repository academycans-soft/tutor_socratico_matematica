import requests

BASE = 'http://localhost:3000'

# 1. Login
login = requests.post(f'{BASE}/api/v1/auths/signin', json={'email': 'academycans@gmail.com', 'password': 'admin123'})
assert login.status_code == 200, f'Login failed: {login.text}'
token = login.json()['token']
headers = {'Authorization': f'Bearer {token}'}
print('1. Admin login success')

# 2. Get Users
res_users = requests.get(f'{BASE}/api/v1/users', headers=headers)
assert res_users.status_code == 200, f'Get users failed: {res_users.text}'
users = res_users.json()
names = [u['name'] for u in users]
print(f'2. Loaded {len(users)} users: {names}')

# 3. Get Classrooms
res_classrooms = requests.get(f'{BASE}/api/v1/classrooms', headers=headers)
assert res_classrooms.status_code == 200, f'Get classrooms failed: {res_classrooms.text}'
print(f'3. Loaded classrooms: {res_classrooms.status_code}')

# 4. Get Tutor Model
res_model = requests.get(f'{BASE}/api/v1/math/tutor/model', headers=headers)
assert res_model.status_code == 200, f'Get model failed: {res_model.text}'
print(f'4. Loaded model: {res_model.json().get("current_model")}')

# 5. Get Roadmap
res_roadmap = requests.get(f'{BASE}/api/v1/curriculum/roadmap', headers=headers)
assert res_roadmap.status_code == 200, f'Get roadmap failed: {res_roadmap.text}'
print(f'5. Loaded {len(res_roadmap.json())} grades in curriculum roadmap')

# 6. Create New User
new_user_payload = {
    'name': 'Lic. Juan Perez',
    'email': 'juan_test_perez@escuela.edu.ec',
    'password': 'password123',
    'role': 'teacher_manager'
}
res_create = requests.post(f'{BASE}/api/v1/users', headers=headers, json=new_user_payload)
assert res_create.status_code == 201, f'Create user failed: {res_create.text}'
created_user = res_create.json()
print(f'6. Created new user: {created_user["name"]} (ID: {created_user["id"]}, Role: {created_user["role"]})')

# 7. Update User Role
res_role = requests.post(f'{BASE}/api/v1/users/update/role', headers=headers, json={'id': created_user['id'], 'role': 'admin'})
assert res_role.status_code == 200, f'Update role failed: {res_role.text}'
print(f'7. Updated user role to: {res_role.json()["role"]}')

# 8. Delete Test User
res_delete = requests.delete(f'{BASE}/api/v1/users/{created_user["id"]}', headers=headers)
assert res_delete.status_code == 200, f'Delete user failed: {res_delete.text}'
print('8. Cleaned up test user successfully')

print('\nALL 8/8 END-TO-END CHECKS PASSED PERFECTLY!')
