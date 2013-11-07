# ORM dependency graph

`A -> B` means that A requires B, but B has no dependencies.

    Photoset <- User
          |    /
          |   /
          v  L
         Photo
