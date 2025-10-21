// idb/db.ts

const DB_NAME = 'DeveloperDB';
const DB_VERSION = 1;
const STORE_NAME = 'developers';

interface Developer {
  name: string;
  age: number;
  salary: number;
  lang: string;
}

class DeveloperDB {
  private db: IDBDatabase | null = null;

  /**
   * 데이터베이스를 초기화하고 연결합니다.
   * onupgradeneeded 이벤트에서 객체 저장소와 인덱스를 생성합니다.
   */
  public init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 데이터베이스 열기 요청
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      // 스키마 변경이 필요할 때 (초기 생성 또는 버전 변경)
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'name' });
          store.createIndex('ageIndex', 'age', { unique: false });
        }
      };

      // 성공적으로 연결되었을 때
      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve();
      };

      // 에러 발생 시
      request.onerror = () => {
        console.error(`Database error: ${request.error}`);
        reject(request.error);
      };
    });
  }

  /**
   * 지정된 모드로 트랜잭션을 시작하고 객체 저장소를 반환합니다.
   * @param mode - 'readonly' 또는 'readwrite'
   * @returns IDBObjectStore
   */
  private getStore(mode: IDBTransactionMode, durability: IDBTransactionDurability = 'default'): IDBObjectStore {
    if (!this.db) {
      throw new Error('Database is not initialized.');
    }
    const tx = this.db.transaction(STORE_NAME, mode, { durability });
    return tx.objectStore(STORE_NAME);
  }

  /**
   * 새로운 개발자 정보를 추가합니다. (Create)
   */
  public addDeveloper(developer: Developer): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.add(developer);
      request.onsuccess = () => resolve();
      request.onerror = (event) => {
         console.error(`Add request error: ${(event.target as IDBRequest).error}`);
         reject((event.target as IDBRequest).error);
      }
    });
  }

  /**
   * 특정 개발자 정보를 조회합니다. (Read)
   */
  public getDeveloper(name: string): Promise<Developer | undefined> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.get(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  /**
   * 개발자 정보를 수정합니다. (Update)
   */
  public updateDeveloper(developer: Developer): Promise<void> {
     return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite');
      const request = store.put(developer);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  /**
   * 개발자 정보를 삭제합니다. (Delete)
   */
  public deleteDeveloper(name: string): Promise<void> {
     return new Promise((resolve, reject) => {
      const store = this.getStore('readwrite', 'strict'); // Durability 예시
      const request = store.delete(name);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  /**
   * 특정 나이 이상의 모든 개발자를 인덱스를 통해 조회합니다.
   */
  public getDevelopersByAge(minAge: number): Promise<Developer[]> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const index = store.index('ageIndex');
      const range = IDBKeyRange.lowerBound(minAge);
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  /**
   * 커서를 사용하여 모든 개발자 정보를 순회하며 콘솔에 출력합니다.
   */
  public logAllDevelopersWithCursor(): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore('readonly');
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          console.log('Cursor:', cursor.value);
          cursor.continue();
        } else {
          console.log('No more entries!');
          resolve();
        }
      };
      request.onerror = (event) => reject((event.target as IDBRequest).error);
    });
  }

  /**
   * 데이터베이스를 삭제합니다. (시연용)
   */
  public deleteDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if(this.db) {
        this.db.close();
      }
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      deleteRequest.onsuccess = () => {
        console.log("Database deleted successfully");
        this.db = null;
        resolve();
      };
      deleteRequest.onerror = () => {
        console.error("Error deleting database");
        reject(deleteRequest.error);
      };
      deleteRequest.onblocked = () => {
        console.warn("Database delete blocked");
      };
    })
  }
}

// 싱글톤 인스턴스 생성
export const db = new DeveloperDB();

// 전체 시연을 위한 함수
export async function runDemo() {
  try {
    console.log('--- 이전 DB 삭제 (시연을 위해) ---');
    await db.deleteDB();

    console.log('\n--- 데이터베이스 초기화 ---');
    await db.init();

    console.log('\n--- C: 개발자 3명 추가 ---');
    await db.addDeveloper({ name: 'Alice', age: 30, salary: 5000, lang: 'JavaScript' });
    await db.addDeveloper({ name: 'Bob', age: 25, salary: 4000, lang: 'Python' });
    await db.addDeveloper({ name: 'Charlie', age: 35, salary: 6000, lang: 'TypeScript' });
    console.log('개발자 추가 완료.');

    console.log('\n--- R: 특정 개발자 조회 (Alice) ---');
    const alice = await db.getDeveloper('Alice');
    console.log('조회된 Alice:', alice);

    console.log('\n--- U: 개발자 정보 수정 (Alice) ---');
    await db.updateDeveloper({ name: 'Alice', age: 31, salary: 5500, lang: 'TypeScript' });
    const updatedAlice = await db.getDeveloper('Alice');
    console.log('수정된 Alice:', updatedAlice);

    console.log('\n--- 인덱스 조회: 30세 이상 개발자 ---');
    const seniorDevs = await db.getDevelopersByAge(30);
    console.log('30세 이상 개발자:', seniorDevs);
    
    console.log('\n--- 커서 순회: 모든 개발자 정보 ---');
    await db.logAllDevelopersWithCursor();

    console.log('\n--- D: 개발자 삭제 (Bob) ---');
    await db.deleteDeveloper('Bob');
    console.log('Bob 삭제 완료.');
    
    console.log('\n--- 삭제된 개발자 확인 (Bob) ---');
    const deletedBob = await db.getDeveloper('Bob');
    console.log('조회된 Bob:', deletedBob); // undefined가 출력되어야 합니다.

    console.log('\n--- 에러 핸들링 시연 (중복 추가) ---');
    try {
      await db.addDeveloper({ name: 'Alice', age: 35, salary: 7000, lang: 'Go' });
    } catch (error) {
      console.error('예상된 에러가 발생했습니다:', error);
    }
    
    console.log('\n--- 시연 종료 ---');

  } catch (error) {
    console.error('시연 중 예기치 않은 에러가 발생했습니다:', error);
  }
}
